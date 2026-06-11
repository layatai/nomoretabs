# Privacy Policy — No More Tabs

_Last updated: June 11, 2026_

No More Tabs is a browser extension that helps you close, switch, group,
and organize tabs. It is designed to work entirely on your device.

## What the extension accesses

- **Tabs** (`tabs` permission): titles, URLs, and favicons of your open
  tabs, used to build the site list, the tab switcher, duplicate
  detection, and tab groups.
- **Visited hostnames**: to power inline autocomplete in the search box
  (e.g. typing `goo` completes to `google.com`), the extension keeps a
  small local index of hostnames you visit while it is installed (at most
  500 hostnames with visit counts, stored on your device via
  `chrome.storage.local`). It does not read your browser history and has
  no `history` permission. Autocomplete can be turned off in
  Preferences → Inline autocomplete.
- **Favicons** (`favicon` permission): the browser's local favicon cache,
  used to show site icons in the palette.
- **Storage** (`storage` permission): your preferences (site grouping
  mode, autocomplete toggle, the "always switch to existing tab" site
  list) are saved with `chrome.storage.sync`, which syncs them between
  your own browsers through your browser vendor's sync service if you
  have sync enabled.

## What the extension does NOT do

- No data ever leaves your device to the developer or any third party.
- No analytics, telemetry, tracking, or advertising of any kind.
- No remote code: all code ships in the extension package.
- No accounts, no sign-in.

## Contact

Questions or concerns: open an issue at
<https://github.com/layatai/nomoretabs/issues>.
