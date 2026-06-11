# Chrome Web Store listing — copy/paste material

## Name

No More Tabs

## Summary (max 132 chars)

Command palette for your tabs: close by site, switch, dedupe, group into
tab groups, and merge windows — all from the keyboard.

## Description

Drowning in tabs? No More Tabs gives you a fast, keyboard-first command
palette to clean them up.

⌨️ ONE PALETTE FOR EVERYTHING
Press Cmd+Shift+X (Mac) / Ctrl+Shift+X to open the palette. Type to
filter, arrows to navigate, Enter to act. The status bar always shows
exactly what Enter will do.

🌐 SITES — every open site with its favicon and tab count.
• Close all tabs of a site
• Group them into a Chrome tab group
• Keep only the latest tab
Use ← → to pick the action.

🔄 TABS — every tab, most recently used first.
• Switch to a tab (Cmd+Shift+Space opens the palette in this mode)
• Close it, or duplicate it

⚡ SLASH COMMANDS — type / for global operations:
• /dedupe — close duplicated tabs (same URL)
• /single — keep one tab per site
• /group — one tab group per site
• /ungroup — remove all tab groups
• /merge — move all tabs into one window
• /domain — group sites by main domain (mail.google.com + docs.google.com
  → google.com)

⌨️ ADDRESS-BAR AUTOCOMPLETE
Type "v" and the palette completes "vnexpress.net" inline from your open
tabs and history — Tab or → accepts. If a URL isn't open, an Open row
creates the tab (terminal-style completion: "github/foo" →
https://github.com/foo). Autocomplete can be disabled in Preferences.

📌 ALWAYS SWITCH TO EXISTING TAB
Keep a list of sites (e.g. your mail or chat app) that should never open
twice: navigating to them focuses the existing tab instead, loading the
link you clicked.

🖱️ Prefer the mouse? Everything is also in the right-click menu, with
per-site close items showing live tab counts.

🔒 SAFE BY DESIGN
• Pinned tabs are never closed, grouped, or moved
• The active / most recently used tab always wins
• 100% local — no data leaves your device, no analytics (see privacy
  policy)

Open source: https://github.com/layatai/nomoretabs

## Category

Tools / Productivity → Workflow & Planning

## Language

English

## Privacy

- Privacy policy URL: https://github.com/layatai/nomoretabs/blob/main/PRIVACY.md
- Single purpose: "Tab management: close, switch, deduplicate, group, and
  organize browser tabs via a command palette and context menus."

### Permission justifications (paste into the Privacy tab)

- **tabs** — Core functionality. Reads titles/URLs/favicons of open tabs
  to list sites and tabs in the palette, detect duplicates, close/switch/
  group tabs.
- **tabGroups** — Creates and removes Chrome tab groups for the "group
  tabs by site" features.
- **contextMenus** — Provides the right-click menu with per-site close
  items and bulk actions.
- **storage** — Saves user preferences (grouping mode, autocomplete
  toggle, the switch-to-existing-tab site list) via chrome.storage.sync.
- **favicon** — Shows site icons in the palette list from the browser's
  local favicon cache.
- **history** — Read locally, only to inline-autocomplete hostnames in
  the palette search box from the user's most-visited sites. Never
  transmitted. User-disableable in Preferences.

### Data usage disclosures

Check ONLY: "This item does not collect user data." (Nothing is
collected, transmitted, or sold.)

## Assets

- `store/screenshot-1.png` … (1280×800)
- Icon: `icons/icon128.png` (uploaded automatically from the package)
