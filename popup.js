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
};

let groupMode = localStorage.getItem("nmt-mode") === "domain" ? "domain" : "host";
let tabsFirst = false; // set when opened via the go-to-tab hotkey
let items = [];
let filtered = [];
let selectedIndex = 0;

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

async function refresh() {
  const groups =
    groupMode === "domain"
      ? await TabOps.groupByMainDomain()
      : await TabOps.groupByHostname();
  const sites = [...groups.entries()].map(([host, tabs]) => ({
    kind: "site",
    label: host,
    sub: "",
    count: tabs.length,
    icon: faviconFor(tabs.find((t) => t.favIconUrl) || tabs[0]),
    host,
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
  }));

  const commands = [
    {
      kind: "command",
      id: "dupes",
      label: "Close duplicated tabs",
      sub: "Keep one tab per exact URL",
      glyph: "⧉",
    },
    {
      kind: "command",
      id: "single",
      label: "Keep single tab per site",
      sub: "Keep only the latest tab of each site",
      glyph: "◎",
    },
    {
      kind: "command",
      id: "group",
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
      id: "prefs",
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
  const q = searchEl.value.trim().toLowerCase();
  filtered = q
    ? items.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          (e.sub || "").toLowerCase().includes(q)
      )
    : items;
  selectedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
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

    if (entry.kind === "site") {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = entry.count;
      li.append(count);
    }

    li.addEventListener("click", () => activate(entry));
    li.addEventListener("mousemove", () => {
      if (selectedIndex !== i) {
        selectedIndex = i;
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
  if (entry.kind === "site") {
    statusEl.textContent = `↵  Close ${entry.count} tab${entry.count === 1 ? "" : "s"} on ${entry.host}`;
  } else if (entry.kind === "tab") {
    statusEl.textContent = "↵  Switch to this tab";
  } else {
    statusEl.textContent = "↵  Run command";
  }
}

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(updateStatus, 1500);
}

async function activate(entry) {
  if (entry.kind === "tab") {
    await chrome.tabs.update(entry.tabId, { active: true });
    await chrome.windows.update(entry.windowId, { focused: true });
    window.close();
    return;
  }
  if (entry.kind === "site") {
    const closed =
      groupMode === "domain"
        ? await TabOps.closeByMainDomain(entry.host)
        : await TabOps.closeByHostname(entry.host);
    searchEl.value = "";
    await refresh();
    flash(`Closed ${closed} tab${closed === 1 ? "" : "s"} on ${entry.host}`);
    return;
  }
  if (entry.id === "dupes") {
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
  selectedIndex = Math.max(
    0,
    Math.min(selectedIndex + delta, filtered.length - 1)
  );
  render();
  listEl.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
}

searchEl.addEventListener("input", () => {
  selectedIndex = 0;
  applyFilter();
});

searchEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveSelection(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveSelection(-1);
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
