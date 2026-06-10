const searchEl = document.getElementById("search");
const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");

const FALLBACK_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
      '<circle cx="8" cy="8" r="6.5" fill="none" stroke="gray" stroke-width="1.2"/>' +
      '<ellipse cx="8" cy="8" rx="3" ry="6.5" fill="none" stroke="gray" stroke-width="1"/>' +
      '<path d="M1.5 8h13M2.5 4.8h11M2.5 11.2h11" stroke="gray" stroke-width="1" fill="none"/>' +
      "</svg>"
  );

const SECTION_TITLES = {
  site: "Sites — Enter closes all tabs",
  tab: "Tabs — Enter switches",
  command: "Commands",
  open: "Open",
};

let groupMode = localStorage.getItem("nmt-mode") === "domain" ? "domain" : "host";
let tabsFirst = false; // set when opened via the go-to-tab hotkey
let items = [];
let filtered = [];
let selectedIndex = 0;
let actionIndex = 0; // which of the selected row's actions is armed
let lastMouse = { x: -1, y: -1 };
let hintSuffix = ""; // ghost completion after the typed text
let hintToken = 0;

const hintPrefixEl = document.getElementById("hint-prefix");
const hintSuffixEl = document.getElementById("hint-suffix");

function renderHint() {
  hintPrefixEl.textContent = hintSuffix ? searchEl.value : "";
  hintSuffixEl.textContent = hintSuffix;
}

// Complete the typed text into a hostname, like terminal autosuggestions.
// Candidates: open tabs' hostnames first, then browser history by visits.
async function updateHint() {
  const token = ++hintToken;
  const q = searchEl.value.trim().toLowerCase();
  let suffix = "";
  if (q && !q.startsWith("/") && !/[\s/]/.test(q)) {
    const candidates = items
      .filter((e) => e.kind === "site")
      .map((e) => e.host);
    try {
      const hist = await chrome.history.search({
        text: q,
        maxResults: 50,
        startTime: 0,
      });
      hist.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
      for (const h of hist) {
        try {
          candidates.push(new URL(h.url).hostname);
        } catch {}
      }
    } catch {}
    outer: for (const c of candidates) {
      for (const host of [c, c.replace(/^www\./, "")]) {
        if (host.toLowerCase().startsWith(q) && host.length > q.length) {
          suffix = host.slice(q.length);
          break outer;
        }
      }
    }
  }
  if (token !== hintToken) return; // a newer keystroke superseded this
  hintSuffix = suffix;
  renderHint();
  applyFilter(); // the Open row uses the completed host
}

function acceptHint() {
  if (!hintSuffix) return false;
  searchEl.value += hintSuffix;
  hintSuffix = "";
  renderHint();
  setSelected(0);
  actionIndex = 0;
  applyFilter();
  updateHint();
  return true;
}

function setSelected(i) {
  if (i !== selectedIndex) actionIndex = 0;
  selectedIndex = i;
}

function currentGroups() {
  return groupMode === "domain"
    ? TabOps.groupByMainDomain()
    : TabOps.groupByHostname();
}

function faviconFor(tab) {
  if (tab.favIconUrl && /^(https?|data):/.test(tab.favIconUrl)) {
    return tab.favIconUrl;
  }
  // Chrome's favicon cache; works for tabs that haven't reported an icon.
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", tab.url || tab.pendingUrl || "");
  url.searchParams.set("size", "16");
  return url.toString();
}

const SITE_ACTIONS = [
  { id: "close", label: "Close all" },
  { id: "group", label: "Group tabs" },
  { id: "keep", label: "Keep latest" },
];
const TAB_ACTIONS = [
  { id: "switch", label: "Switch" },
  { id: "close", label: "Close tab" },
  { id: "dup", label: "Duplicate" },
];

// terminal-style completion: "github.com/foo" -> https://github.com/foo,
// "localhost:3000" stays, a bare word gets a .com suffix
function resolveOpenUrl(q) {
  if (/\s/.test(q)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q)) return q;
  const host = q.split(/[/?#]/)[0];
  if (!host) return null;
  if (!host.includes(".") && !host.includes(":")) {
    return "https://" + q.replace(host, host + ".com");
  }
  return "https://" + q;
}

async function refresh() {
  const groups = await currentGroups();
  const sites = [...groups.entries()].map(([host, tabs]) => ({
    kind: "site",
    label: host,
    sub: "",
    count: tabs.length,
    icon: faviconFor(tabs.find((t) => t.favIconUrl) || tabs[0]),
    host,
    actions: SITE_ACTIONS,
  }));

  const allTabs = await TabOps.allTabs();
  allTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const tabs = allTabs.map((t) => ({
    kind: "tab",
    label: t.title || t.url || "",
    sub: TabOps.hostnameOf(t),
    icon: faviconFor(t),
    tabId: t.id,
    windowId: t.windowId,
    actions: TAB_ACTIONS,
  }));

  const commands = [
    {
      kind: "command",
      id: "dupes",
      slash: "dedupe",
      label: "Close duplicated tabs",
      sub: "Keep one tab per exact URL",
      glyph: "⧉",
    },
    {
      kind: "command",
      id: "single",
      slash: "single",
      label: "Keep single tab per site",
      sub: "Keep only the latest tab of each site",
      glyph: "◎",
    },
    {
      kind: "command",
      id: "group",
      slash: "domain",
      label:
        groupMode === "domain"
          ? "Group sites by hostname"
          : "Group sites by main domain",
      sub:
        groupMode === "domain"
          ? "Currently grouping by main domain"
          : "e.g. mail.google.com + docs.google.com → google.com",
      glyph: "↻",
    },
    {
      kind: "command",
      id: "tabgroups",
      slash: "group",
      label: "Group all tabs by site",
      sub: `One tab group per ${groupMode === "domain" ? "main domain" : "hostname"} (2+ tabs)`,
      glyph: "▦",
    },
    {
      kind: "command",
      id: "ungroup",
      slash: "ungroup",
      label: "Ungroup all tabs",
      sub: "Remove every tab group",
      glyph: "▢",
    },
    {
      kind: "command",
      id: "merge",
      slash: "merge",
      label: "Merge all windows",
      sub: "Move every tab into this window",
      glyph: "⧈",
    },
    {
      kind: "command",
      id: "prefs",
      slash: "prefs",
      label: "Preferences…",
      sub: "Sites that always switch to the existing tab",
      glyph: "⚙",
    },
  ];

  items = tabsFirst
    ? [...tabs, ...sites, ...commands]
    : [...sites, ...tabs, ...commands];
  applyFilter();
}

function applyFilter() {
  const raw = searchEl.value.trim().toLowerCase();
  if (raw.startsWith("/")) {
    // slash mode: commands only, matched by alias or label
    const q = raw.slice(1);
    filtered = items.filter(
      (e) =>
        e.kind === "command" &&
        (e.slash.startsWith(q) || e.label.toLowerCase().includes(q))
    );
  } else {
    filtered = raw
      ? items.filter(
          (e) =>
            e.label.toLowerCase().includes(raw) ||
            (e.sub || "").toLowerCase().includes(raw)
        )
      : items;
    const url = raw && resolveOpenUrl(searchEl.value.trim() + hintSuffix);
    if (url) {
      filtered = [
        ...filtered,
        {
          kind: "open",
          label: `Open ${url}`,
          sub: "in a new tab",
          glyph: "+",
          url,
        },
      ];
    }
  }
  setSelected(Math.min(selectedIndex, Math.max(0, filtered.length - 1)));
  render();
}

function render() {
  const nodes = [];
  let prevKind = null;
  filtered.forEach((entry, i) => {
    if (entry.kind !== prevKind) {
      prevKind = entry.kind;
      const header = document.createElement("li");
      header.className = "header";
      header.textContent = SECTION_TITLES[entry.kind];
      nodes.push(header);
    }

    const li = document.createElement("li");
    li.className = "item";
    li.classList.toggle("selected", i === selectedIndex);

    if (entry.glyph) {
      const glyph = document.createElement("span");
      glyph.className = "favicon glyph";
      glyph.textContent = entry.glyph;
      li.append(glyph);
    } else {
      const icon = document.createElement("img");
      icon.className = "favicon";
      icon.src = entry.icon || FALLBACK_ICON;
      icon.addEventListener("error", () => (icon.src = FALLBACK_ICON));
      li.append(icon);
    }

    const text = document.createElement("span");
    text.className = "text";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = entry.label;
    text.append(label);
    if (entry.sub) {
      const sub = document.createElement("span");
      sub.className = "sub";
      sub.textContent = entry.sub;
      text.append(sub);
    }
    li.append(text);

    if (i === selectedIndex && entry.actions?.length > 1) {
      const action = document.createElement("span");
      action.className = "action";
      action.textContent = `◂ ${entry.actions[actionIndex].label} ▸`;
      li.append(action);
    } else if (entry.kind === "site") {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = entry.count;
      li.append(count);
    } else if (entry.kind === "command") {
      const slash = document.createElement("span");
      slash.className = "count";
      slash.textContent = "/" + entry.slash;
      li.append(slash);
    }

    li.addEventListener("click", () => activate(entry));
    li.addEventListener("mousemove", (e) => {
      // Chrome re-fires mousemove on the element under a stationary
      // cursor whenever the list DOM is replaced (e.g. after arrow-key
      // re-renders); only treat real pointer movement as hover.
      if (lastMouse.x === e.screenX && lastMouse.y === e.screenY) return;
      lastMouse = { x: e.screenX, y: e.screenY };
      if (selectedIndex !== i) {
        setSelected(i);
        render();
      }
    });
    nodes.push(li);
  });

  listEl.replaceChildren(...nodes);
  updateStatus();
}

function updateStatus() {
  if (!filtered.length) {
    statusEl.textContent = items.length ? "No matches" : "No open tabs";
    return;
  }
  const entry = filtered[selectedIndex];
  if (!entry) return;
  const action = entry.actions?.[actionIndex]?.id;
  const n = entry.count;
  let text;
  if (entry.kind === "site") {
    text =
      action === "group"
        ? `↵  Group ${n} tab${n === 1 ? "" : "s"} on ${entry.host} into a tab group`
        : action === "keep"
          ? `↵  Keep latest tab on ${entry.host}, close the rest`
          : `↵  Close ${n} tab${n === 1 ? "" : "s"} on ${entry.host}`;
  } else if (entry.kind === "tab") {
    text =
      action === "close"
        ? "↵  Close this tab"
        : action === "dup"
          ? "↵  Duplicate this tab"
          : "↵  Switch to this tab";
  } else if (entry.kind === "open") {
    text = `↵  Open ${entry.url} in a new tab`;
  } else {
    text = "↵  Run command";
  }
  if (entry.actions?.length > 1) text += "  ·  ◂ ▸ actions";
  statusEl.textContent = text;
}

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(updateStatus, 1500);
}

async function activate(entry) {
  const action = entry.actions?.[actionIndex]?.id;
  actionIndex = 0;
  if (entry.kind === "open") {
    await chrome.tabs.create({ url: entry.url });
    window.close();
    return;
  }
  if (entry.kind === "tab") {
    if (action === "close") {
      await chrome.tabs.remove(entry.tabId);
      await refresh();
      flash("Closed tab");
      return;
    }
    if (action === "dup") {
      await chrome.tabs.duplicate(entry.tabId);
      window.close();
      return;
    }
    await chrome.tabs.update(entry.tabId, { active: true });
    await chrome.windows.update(entry.windowId, { focused: true });
    window.close();
    return;
  }
  if (entry.kind === "site") {
    if (action === "group") {
      const grouped = await TabOps.groupIntoTabGroups(await currentGroups(), entry.host);
      await refresh();
      flash(`Grouped ${grouped} tab${grouped === 1 ? "" : "s"} on ${entry.host}`);
      return;
    }
    if (action === "keep") {
      const closed = await TabOps.keepLatestInGroup(await currentGroups(), entry.host);
      await refresh();
      flash(`Closed ${closed} tab${closed === 1 ? "" : "s"} on ${entry.host}`);
      return;
    }
    const closed =
      groupMode === "domain"
        ? await TabOps.closeByMainDomain(entry.host)
        : await TabOps.closeByHostname(entry.host);
    searchEl.value = "";
    hintSuffix = "";
    renderHint();
    await refresh();
    flash(`Closed ${closed} tab${closed === 1 ? "" : "s"} on ${entry.host}`);
    return;
  }
  searchEl.value = ""; // leave slash mode after running a command
  hintSuffix = "";
  renderHint();
  if (entry.id === "tabgroups") {
    const grouped = await TabOps.groupIntoTabGroups(await currentGroups());
    await refresh();
    flash(`Grouped ${grouped} tab${grouped === 1 ? "" : "s"} by site`);
  } else if (entry.id === "ungroup") {
    const n = await TabOps.ungroupAll();
    await refresh();
    flash(`Ungrouped ${n} tab${n === 1 ? "" : "s"}`);
  } else if (entry.id === "merge") {
    const n = await TabOps.mergeAllWindows();
    await refresh();
    flash(`Moved ${n} tab${n === 1 ? "" : "s"} into this window`);
  } else if (entry.id === "dupes") {
    const closed = await TabOps.closeDuplicates();
    await refresh();
    flash(`Closed ${closed} duplicated tab${closed === 1 ? "" : "s"}`);
  } else if (entry.id === "single") {
    const closed = await TabOps.keepSingleTabPerHostname();
    await refresh();
    flash(`Closed ${closed} tab${closed === 1 ? "" : "s"}`);
  } else if (entry.id === "prefs") {
    chrome.runtime.openOptionsPage();
    window.close();
    return;
  } else if (entry.id === "group") {
    groupMode = groupMode === "domain" ? "host" : "domain";
    localStorage.setItem("nmt-mode", groupMode);
    await refresh();
    flash(`Grouping sites by ${groupMode === "domain" ? "main domain" : "hostname"}`);
  }
  searchEl.focus();
}

function moveSelection(delta) {
  setSelected(
    Math.max(0, Math.min(selectedIndex + delta, filtered.length - 1))
  );
  render();
  listEl.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
}

// Cycle the selected row's action, but only when the key would not move
// the caret anyway (Right at end of input, Left at start) so text editing
// keeps working.
function cycleAction(delta) {
  const entry = filtered[selectedIndex];
  if (!entry?.actions || entry.actions.length < 2) return false;
  const caretAtEnd =
    searchEl.selectionStart === searchEl.value.length &&
    searchEl.selectionEnd === searchEl.value.length;
  const caretAtStart = searchEl.selectionStart === 0 && searchEl.selectionEnd === 0;
  if (delta > 0 && !caretAtEnd) return false;
  if (delta < 0 && !caretAtStart) return false;
  const len = entry.actions.length;
  actionIndex = (actionIndex + delta + len) % len;
  render();
  return true;
}

searchEl.addEventListener("input", () => {
  setSelected(0);
  actionIndex = 0; // a new query re-arms the default action
  applyFilter();
  updateHint();
});

searchEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveSelection(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveSelection(-1);
  } else if (e.key === "Tab") {
    if (acceptHint()) e.preventDefault();
  } else if (e.key === "ArrowRight") {
    const atEnd =
      searchEl.selectionStart === searchEl.value.length &&
      searchEl.selectionEnd === searchEl.value.length;
    if (atEnd && hintSuffix) {
      e.preventDefault();
      acceptHint();
    } else if (cycleAction(1)) {
      e.preventDefault();
    }
  } else if (e.key === "ArrowLeft") {
    if (cycleAction(-1)) e.preventDefault();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (filtered[selectedIndex]) activate(filtered[selectedIndex]);
  } else if (e.key === "Escape") {
    window.close();
  }
});

// The go-to-tab hotkey sets a flag before opening the popup.
chrome.storage.session.get("nmt-open-view").then(({ "nmt-open-view": v }) => {
  chrome.storage.session.remove("nmt-open-view");
  tabsFirst = v === "goto";
  refresh().then(() => searchEl.focus());
});
