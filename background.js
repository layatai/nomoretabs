importScripts("tabops.js");

const MENU_ROOT = "nmt-root";
const MENU_BY_HOST = "nmt-by-host";
const MENU_BY_DOMAIN = "nmt-by-domain";
const MENU_DUPES = "nmt-dupes";
const MENU_SINGLE = "nmt-single";
const HOST_PREFIX = "nmt-host:";
const DOMAIN_PREFIX = "nmt-domain:";

let rebuildTimer = null;
let rebuilding = false;
let rebuildQueued = false;

function scheduleMenuRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildMenus, 400);
}

async function rebuildMenus() {
  // Serialize rebuilds: removeAll + create is not atomic.
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }
  rebuilding = true;
  try {
    await chrome.contextMenus.removeAll();
    const groups = await TabOps.groupByHostname();

    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: "No More Tabs",
      contexts: ["page", "action"],
    });
    chrome.contextMenus.create({
      id: MENU_BY_HOST,
      parentId: MENU_ROOT,
      title: "Close all by hostname",
      contexts: ["page", "action"],
    });

    let i = 0;
    for (const [host, tabs] of groups) {
      if (++i > 30) break; // context menus get unwieldy beyond this
      chrome.contextMenus.create({
        id: HOST_PREFIX + host,
        parentId: MENU_BY_HOST,
        title: `${host} (${tabs.length})`,
        contexts: ["page", "action"],
      });
    }

    chrome.contextMenus.create({
      id: MENU_BY_DOMAIN,
      parentId: MENU_ROOT,
      title: "Close all by domain",
      contexts: ["page", "action"],
    });

    const domainGroups = await TabOps.groupByMainDomain();
    let j = 0;
    for (const [domain, tabs] of domainGroups) {
      if (++j > 30) break;
      chrome.contextMenus.create({
        id: DOMAIN_PREFIX + domain,
        parentId: MENU_BY_DOMAIN,
        title: `${domain} (${tabs.length})`,
        contexts: ["page", "action"],
      });
    }

    chrome.contextMenus.create({
      id: MENU_DUPES,
      parentId: MENU_ROOT,
      title: "Close duplicated",
      contexts: ["page", "action"],
    });
    chrome.contextMenus.create({
      id: MENU_SINGLE,
      parentId: MENU_ROOT,
      title: "Keep single tab per hostname",
      contexts: ["page", "action"],
    });
  } finally {
    rebuilding = false;
    if (rebuildQueued) {
      rebuildQueued = false;
      scheduleMenuRebuild();
    }
  }
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === MENU_DUPES) {
    await TabOps.closeDuplicates();
  } else if (info.menuItemId === MENU_SINGLE) {
    await TabOps.keepSingleTabPerHostname();
  } else if (String(info.menuItemId).startsWith(HOST_PREFIX)) {
    await TabOps.closeByHostname(String(info.menuItemId).slice(HOST_PREFIX.length));
  } else if (String(info.menuItemId).startsWith(DOMAIN_PREFIX)) {
    await TabOps.closeByMainDomain(String(info.menuItemId).slice(DOMAIN_PREFIX.length));
  }
});

// --- Enforced switch-to-tab ---------------------------------------------
// For sites listed in preferences, never keep two tabs: when a tab
// navigates INTO such a site and another tab of it already exists, the
// existing tab is focused (and pointed at the requested URL) and the
// navigating tab is closed.

let enforcedHosts = [];
chrome.storage.sync
  .get({ enforcedHosts: [] })
  .then((v) => (enforcedHosts = v.enforcedHosts));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enforcedHosts) {
    enforcedHosts = changes.enforcedHosts.newValue || [];
  }
});

// entry "google.com" matches google.com and any subdomain
function enforcedEntryFor(host) {
  if (!host) return null;
  return (
    enforcedHosts.find((e) => host === e || host.endsWith("." + e)) || null
  );
}

// Last known hostname per tab, to tell "entering a site" apart from
// "browsing within it". Re-seeded when the service worker restarts.
const lastHostByTab = new Map();

async function seedLastHosts() {
  for (const tab of await TabOps.allTabs()) {
    lastHostByTab.set(tab.id, TabOps.hostnameOf(tab));
  }
}
seedLastHosts();

chrome.tabs.onRemoved.addListener((tabId) => lastHostByTab.delete(tabId));

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  let host;
  try {
    host = new URL(changeInfo.url).hostname;
  } catch {
    return;
  }
  const prevHost = lastHostByTab.get(tabId);
  lastHostByTab.set(tabId, host);

  const entry = enforcedEntryFor(host);
  if (!entry) return;
  if (enforcedEntryFor(prevHost) === entry) return; // within-site navigation

  const others = (await TabOps.allTabs()).filter(
    (t) => t.id !== tabId && enforcedEntryFor(TabOps.hostnameOf(t)) === entry
  );
  if (!others.length) return;

  const keep = others.reduce((best, t) =>
    (t.lastAccessed || 0) > (best.lastAccessed || 0) ? t : best
  );
  await chrome.tabs.update(keep.id, {
    active: true,
    ...(keep.url !== changeInfo.url ? { url: changeInfo.url } : {}),
  });
  await chrome.windows.update(keep.windowId, { focused: true });
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // tab already gone
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-goto-palette") {
    await chrome.storage.session.set({ "nmt-open-view": "goto" });
    try {
      await chrome.action.openPopup();
    } catch {
      // openPopup can fail if another popup is open; flag stays for next open
    }
  }
});

chrome.runtime.onInstalled.addListener(rebuildMenus);
chrome.runtime.onStartup.addListener(rebuildMenus);
chrome.tabs.onCreated.addListener(scheduleMenuRebuild);
chrome.tabs.onRemoved.addListener(scheduleMenuRebuild);
chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.url) scheduleMenuRebuild();
});
