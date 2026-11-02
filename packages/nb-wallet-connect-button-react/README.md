# nb-wallet-connect-button-react

Wallet Connect button for **NB Wallet** (shown to users as the **ZZP Garantie app**), talking to NB Wallet Connect (`connect.nbwallet.org`). Part of [wallet-connect-buttons](https://github.com/kvk-innovatie/wallet-connect-buttons).

## Installation

```bash
npm install nb-wallet-connect-button-react
```

## Usage

```jsx
import { WalletConnectButton } from "nb-wallet-connect-button-react";
// or, without the embedded RO Sans fonts:
// import { WalletConnectButton } from "nb-wallet-connect-button-react/slim";

<WalletConnectButton
  serviceId="your-service-id"
  apiKey="your-api-key"
  lang="en"
  onSuccess={(attributes) => console.log(attributes)}
/>
```

## Props

- `serviceId` – the registration's identifier (NB Wallet Connect calls it a **service id**). `clientId` is the
  original name for the same value and still works; `serviceId` wins when both are set.
- `apiKey` – optional. With it the button calls the wallet-connect server directly; without it the page's own
  backend must proxy `/api/create-session` and `/api/disclosed-attributes` (see `examples/backends`).
- `onSuccess(attributes)` – called with the disclosed attributes once a session finished.
- `onFailed(outcome)` – optional; called when the user closes the dialog after a failure.
- `label` – button text (defaults to the wallet's own, in `lang`).
- `lang` – `"nl"` (default) or `"en"`.
- `helpBaseUrl` – optional; where "No app yet?" links point (defaults per wallet).
- `issuance` – the session issues data to the wallet instead of asking for it.
- `useLocalWcServer` – talk to a wallet-connect server on localhost (development).
- `returnUrl` – where the wallet sends the user after a same-device disclosure (iframe support, see below).

Under the QR code the dialog offers the ZZP Garantie app download per role (director / employee) when a
`serviceId` is set, so a fresh install knows where the user came from.
- `className`, `style`, `classes={{ button, label }}` – styling hooks for the button and its label; the stable class
  names are `.wcb-button` and `.wcb-button__label`.

Requires React 18 or 19. The dialog is rendered into `document.body` with `createPortal`.

### Embedding in an iframe

Cross-device (QR code) works in an iframe as is. Same-device needs two things, because the wallet app returns
the user to a page and the button inside the iframe cannot see the address of the page around it:

1. Set `returnUrl` to the full address of the page that contains the iframe.
2. On that page, when it loads with `session_token` (and, if present, `nonce`) in its query string, hand them
   to the iframe. Either append them to the iframe's `src`, or post them in:

```javascript
const params = new URLSearchParams(window.location.search);
const sessionToken = params.get("session_token");
if (sessionToken) {
  const iframe = document.querySelector("iframe#wallet");
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      { type: "wallet-connect-session", session_token: sessionToken, nonce: params.get("nonce") ?? undefined },
      new URL(iframe.src).origin,
    );
  });
  params.delete("session_token");
  params.delete("nonce");
  history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
}
```

The button only accepts the message when it comes from the origin of `returnUrl`.

## Migrating from 1.x

| 1.x | 2.0 |
|---|---|
| `nl-wallet-button::part(button) { … }` | `.wcb-button { … }` (or the `className` / `classes` props) |
| `nl-wallet-button::part(button-span) { … }` | `.wcb-button__label { … }` |
| `axios` peer dependency | none (uses `fetch`) |
| `nbwallet` prop | use the `nb-wallet-connect-button-*` package; the prop still works here but warns and goes away in 3.0 |
| a web component (`<nl-wallet-button>`) inside the component | native markup; the dialog is rendered into `<body>` |

Everything else (props, events, the `onSuccess` payload, the iframe hand-over message, the backend proxy
contract) is unchanged. The dialog can be themed with CSS custom properties on `.wcb-overlay`
(`--primary-color`, `--primary-hover`, `--text-color`, …). Import `/slim` to leave out the embedded RO Sans
fonts (about 140 KB).

For further explanation and documentation, visit: https://wallet-connect.eu
