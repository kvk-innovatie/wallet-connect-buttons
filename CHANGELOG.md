# Changelog

The three packages (`wallet-connect-button-{react,vue,vanillajs}`) share one version. The NB Wallet packages are
released from the nb-wallet-connect-buttons repository.

## 2.1.0

Issuance on today's wallet-connect.eu, which runs the WE BUILD lane.

### Changed

- **Issuance uses wallet-connect's issuance sessions.** The old issuance hosts (`issuance.wallet-connect.eu`,
  `bw.issuance.wallet-connect.eu`) answer 410, so the static `disclosure_based_issuance` links no longer work. An
  `issuance` button now creates a session when the dialog opens (`POST /api/issuance/sessions?lang=…` with
  `{ usecase }` on wallet-connect.eu, bw.wallet-connect.eu for `business`, the local disclosure host with
  `useLocalWcServer`), polls it like a disclosure and shows every link it hands out: an ID-step request
  (`openid4vp://`) if the issuer has one, then the credential offer (`openid-credential-offer://`). No API key
  or backend is needed. 18up has no issuance host of its own and issues on wallet-connect.eu as well. A brand can
  still choose the static links (`issuanceFlow: "static"`); none in this repository does.
- **No cancel after the offer.** Closing the dialog before the offer was shown cancels the session (DELETE), as a
  disclosure does. Once the offer was shown the session is left to expire, since a wallet may still be collecting the
  credential, and the dialog ends with the `close` outcome (the lane never reports whether the credential was
  collected). While the offer is on screen, up to three failed status requests in a row leave it there.
- **An issuance dialog can end on an error screen.** A 2.0.0 issuance only ever ended with `close`. Now the
  dialog shows an error when the session cannot be started (network, or a client id the lane does not know), when
  the ID step fails or is stopped, when more than three status requests in a row fail, or when the offer expires
  on screen (after about ten minutes, even if the wallet collected the credential). Closing it calls `onFailed`
  (React, Vue) or fires `failed` (vanilla).
- **What else a host page notices for issuance.** The dialog now makes requests: a JSON `POST` (with a CORS
  preflight) to wallet-connect.eu or bw.wallet-connect.eu, so a page's CSP needs them in `connect-src`. Every
  issuer client id must exist as a usecase on the lane. On a phone the link is the lane's generic
  `openid-credential-offer://` (or `openid4vp://`) link, so the operating system picks the wallet app, instead of
  the brand's own app scheme. With `apiKey`, the issuer's requested credentials can now show under the QR code
  (the old issuance host answered 410). With `useLocalWcServer`, issuance goes to the local disclosure host on
  port 5021 (the mock serves it); the static issuance servers on 5007 and 5017 are no longer used.
- **An issuance button ignores a returning disclosure.** It no longer picks up a `session_token` in the page
  address (or a `wallet-connect-session` message), which belongs to a disclosure button on the same page; before,
  it fetched disclosed attributes for it and showed an error card.

### Added

- `sessionUrl` and `sessionBody` (`session-url` / `session-body` for the vanilla element): start the session
  through the page's own backend, for issuance and disclosure alike. The dialog POSTs `sessionBody` (JSON, `{}`
  by default) to `sessionUrl`, expects `{ session_token, status_url }` back (a relative `status_url` is resolved
  against `sessionUrl`) and follows `status_url` as usual. A new `sessionBody` object with the same content
  keeps the button and an open dialog as they are.
- The mock wallet-connect server (examples) serves the lane's issuance sessions (`MOCK_ID_STEP`,
  `MOCK_OFFER_POLLS`).

### Fixed

- A session created after its dialog was closed, or replaced by a newer start (React StrictMode runs effects
  twice), is cancelled instead of left open; a status answer that arrives after the user stopped or closed no
  longer changes the dialog.
- A session start may take up to 15 s (`START_TIMEOUT`; it was aborted after 5 s like every request), so a slow
  backend (`sessionUrl`, or one that proxies `/api/create-session`) no longer ends in the network error while it
  creates the session anyway; a start answer that arrives after the dialog gave up, closed or started again is
  cancelled (DELETE) and never shown. Status requests and cancels keep their 5 s.
- A session answer without a usable `status_url` shows the error screen instead of polling a made-up address.

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
