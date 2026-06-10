# No More Tabs

A Chrome/Brave extension to bulk-close tabs by hostname, close duplicate
tabs, or keep only the latest tab per hostname.

## Features

- **Command palette** — one search box, one list, no buttons. Press
  `Cmd+Shift+X` (Mac) / `Ctrl+Shift+X` (Windows/Linux) or click the
  toolbar icon. The list has three sections, all filtered as you type:
  - **Sites** — favicon + `hostname (count)`; `Enter` closes every tab
    for that site.
  - **Tabs** — all tabs, most recently used first, with favicon, title,
    and hostname; `Enter` switches to the tab.
  - **Commands** — *Close duplicated tabs*, *Keep single tab per site*,
    and *Group sites by main domain / hostname* (toggles whether sites
    are grouped per subdomain or per registrable domain, e.g.
    `mail.google.com` + `docs.google.com` → `google.com`; remembered).

  The status bar at the bottom always shows what `Enter` will do.
- **Go-to-tab hotkey** — `Cmd+Shift+Space` (Mac) / `Ctrl+Shift+Space`
  opens the same palette with the **Tabs** section on top for quick
  switching.
- **Always switch to existing tab** — in Preferences (the *Preferences…*
  command in the palette, or the extension's Options page) you can keep
  an editable list of sites. When a tab navigates into one of those sites
  and a tab for it is already open, the existing tab is focused (and
  pointed at the requested URL) and the duplicate closes. Entries cover
  their subdomains (`google.com` matches `mail.google.com`). Click an
  entry to edit it; clear it or press ✕ to remove. The list syncs via
  `chrome.storage.sync`.
- **Right-click menu** — right-click any page (or the toolbar icon) →
  **No More Tabs**:
  - **Close all by hostname** — submenu listing `hostname (x)` for every
    open hostname; click one to close all its tabs.
  - **Close all by domain** — same, but grouped by main domain
    (`google.com` covers all its subdomains).
  - **Close duplicated** — closes tabs whose exact URL is open more than
    once, keeping the most recently used one.
  - **Keep single tab per hostname** — keeps only the latest tab per
    hostname, closes the rest.

Pinned tabs are never closed. The active tab is always the one kept when
deduplicating.

## Install

1. Open `chrome://extensions` (or `brave://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.

To change the hotkey: `chrome://extensions/shortcuts`.

## Files

- `manifest.json` — Manifest V3 config
- `background.js` — service worker; builds the context menus and handles clicks
- `tabops.js` — shared tab grouping/closing logic
- `popup.html` / `popup.css` / `popup.js` — the command palette popup
