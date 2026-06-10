// Shared tab operations. Loaded by the service worker (importScripts)
// and by the popup (script tag).

const TabOps = {
  // Pinned tabs are never closed by any operation.
  async allTabs() {
    return chrome.tabs.query({ windowType: "normal" });
  },

  hostnameOf(tab) {
    try {
      const url = new URL(tab.url || tab.pendingUrl || "");
      return url.hostname || url.protocol.replace(":", "");
    } catch {
      return "";
    }
  },

  // Second-level public suffixes where the main domain needs three labels
  // (e.g. example.co.uk). Covers the common cases without a full PSL.
  SECOND_LEVEL_SUFFIXES: new Set([
    "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk",
    "com.au", "net.au", "org.au", "edu.au", "gov.au",
    "co.nz", "net.nz", "org.nz",
    "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
    "com.br", "net.br", "org.br", "gov.br",
    "co.in", "net.in", "org.in", "gov.in", "ac.in",
    "com.cn", "net.cn", "org.cn", "gov.cn",
    "com.tw", "org.tw", "com.hk", "com.sg", "com.my",
    "com.vn", "net.vn", "org.vn", "edu.vn", "gov.vn",
    "co.kr", "or.kr", "go.kr", "ac.kr",
    "com.mx", "com.ar", "com.tr", "com.sa", "co.za", "co.id",
  ]),

  // "Main domain" = registrable domain: google.com, example.co.uk.
  // IPs and single-label hosts (localhost) are returned unchanged.
  mainDomainOf(hostname) {
    if (!hostname || /^[\d.]+$/.test(hostname) || hostname.includes(":")) {
      return hostname;
    }
    const labels = hostname.split(".");
    if (labels.length <= 2) return hostname;
    const lastTwo = labels.slice(-2).join(".");
    const take = this.SECOND_LEVEL_SUFFIXES.has(lastTwo) ? 3 : 2;
    return labels.slice(-take).join(".");
  },

  // Map of key -> tabs, sorted by tab count descending.
  // keyFn maps a tab to its grouping key (hostname or main domain).
  async groupBy(keyFn) {
    const tabs = await this.allTabs();
    const groups = new Map();
    for (const tab of tabs) {
      const key = keyFn(tab);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tab);
    }
    return new Map(
      [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
    );
  },

  async groupByHostname() {
    return this.groupBy((tab) => this.hostnameOf(tab));
  },

  async groupByMainDomain() {
    return this.groupBy((tab) => this.mainDomainOf(this.hostnameOf(tab)));
  },

  async closeGroup(groups, key) {
    const tabs = groups.get(key) || [];
    const ids = tabs.filter((t) => !t.pinned).map((t) => t.id);
    if (ids.length) await chrome.tabs.remove(ids);
    return ids.length;
  },

  async closeByHostname(hostname) {
    return this.closeGroup(await this.groupByHostname(), hostname);
  },

  async closeByMainDomain(domain) {
    return this.closeGroup(await this.groupByMainDomain(), domain);
  },

  // Close tabs whose URL already appeared in another tab.
  // Keeps the most recently accessed tab of each URL (active tabs win).
  async closeDuplicates() {
    const tabs = await this.allTabs();
    const byUrl = new Map();
    for (const tab of tabs) {
      const url = tab.url || tab.pendingUrl;
      if (!url) continue;
      if (!byUrl.has(url)) byUrl.set(url, []);
      byUrl.get(url).push(tab);
    }
    const toClose = [];
    for (const group of byUrl.values()) {
      if (group.length < 2) continue;
      const keep = group.reduce((best, t) => {
        if (t.active && !best.active) return t;
        if (!t.active && best.active) return best;
        return (t.lastAccessed || 0) > (best.lastAccessed || 0) ? t : best;
      });
      for (const t of group) {
        if (t.id !== keep.id && !t.pinned) toClose.push(t.id);
      }
    }
    if (toClose.length) await chrome.tabs.remove(toClose);
    return toClose.length;
  },

  // Keep only the latest tab per hostname, close the rest.
  // "Latest" = most recently accessed; the active tab always wins.
  async keepSingleTabPerHostname() {
    const groups = await this.groupByHostname();
    const toClose = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const keep = group.reduce((best, t) => {
        if (t.active && !best.active) return t;
        if (!t.active && best.active) return best;
        return (t.lastAccessed || 0) > (best.lastAccessed || 0) ? t : best;
      });
      for (const t of group) {
        if (t.id !== keep.id && !t.pinned) toClose.push(t.id);
      }
    }
    if (toClose.length) await chrome.tabs.remove(toClose);
    return toClose.length;
  },
};

if (typeof module !== "undefined") module.exports = TabOps;
