# Changelog

All six packages (`wallet-connect-button-{react,vue,vanillajs}`, `nb-wallet-connect-button-{react,vue,vanillajs}`)
share one version.

## 2.0.0

The buttons are now native implementations on a shared, framework-agnostic core instead of wrappers around
the `nl-wallet-web.js` web component. React users no longer ship a Vue runtime; the vanilla element is one
custom element with one shadow root.

### Breaking

- **Styling.** `nl-wallet-button::part(button)` / `::part(button-span)` no longer match for React and Vue
  (there is no shadow root). Use the stable classes `.wcb-button` and `.wcb-button__label`, the React
  `className` / `style` / `classes` props, or Vue `class` fall-through. The vanilla element keeps `::part`,
  under its own tag: `wallet-connect-button::part(button)`.
- **Vanilla distribution.** Published on npm; load it from
  `https://cdn.jsdelivr.net/npm/wallet-connect-button-vanillajs@2/dist/wallet-connect-button.js`. The 1.x
  `cdn.jsdelivr.net/gh/...` URLs keep serving the versions they pin.
- **Peer dependencies.** `axios` is gone (the buttons use `fetch`). React `^18 || ^19`, Vue `^3.3`.
- **NB Wallet / ZZP Garantie** has its own packages: `nb-wallet-connect-button-react`, `-vue`, `-vanillajs`
  (`<nb-wallet-connect-button>`). The `nbwallet` prop/attribute on the other packages still works in 2.x,
  logs a deprecation warning, and is removed in 3.0.
- The default button label is the wallet's own text in the chosen language for every framework (1.x
  differed: "Connect Wallet", "Inloggen met NP Wallet", a translation).
- The footer "Need help?" link now points at `<help-base-url>/help` (1.x: the page's own `/help`).

### Added

- `/slim` entries (and `.slim.js` CDN files) without the embedded RO Sans fonts, about 140 KB smaller.
- `onFailed(outcome)` prop (`failed` event unchanged for vanilla).
- Theming through CSS custom properties on `.wcb-overlay` (`--primary-color`, `--primary-hover`,
  `--secondary-hover`, `--text-color`, `--error-color`, …).
- The "required credentials" list is part of the dialog instead of being injected into a shadow root.
- The dialog is rendered into `<body>` (React `createPortal`, Vue `Teleport`), so it is no longer clipped or
  stacked by its container.

### Unchanged

Props/attributes and their names, the `onSuccess` payload, the `success` / `failed` events, the iframe
hand-over message (`wallet-connect-session`), the backend proxy contract, the hosts per wallet.

## 1.x

See the archived repositories `wallet-connect-button-react`, `wallet-connect-button-vue` and
`wallet-connect-button-vanillajs` (history is in this repository under `react-v*`, `vue-v*`, `vanilla-v*` tags).
