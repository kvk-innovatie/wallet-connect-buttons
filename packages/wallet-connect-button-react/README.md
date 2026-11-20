# wallet-connect-button-react

Wallet Connect button for **NP Wallet**, **Business Wallet** and **18up**. Part of [wallet-connect-buttons](https://github.com/kvk-innovatie/wallet-connect-buttons). For NB Wallet / ZZP Garantie use the `nb-wallet-connect-button-*` packages.

## Installation

```bash
npm install wallet-connect-button-react
```

## Usage

```jsx
import { WalletConnectButton } from "wallet-connect-button-react";
// or, without the embedded RO Sans fonts:
// import { WalletConnectButton } from "wallet-connect-button-react/slim";

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
  backend must proxy `/api/create-session` and `/api/disclosed-attributes` (see `examples/backends`). An
  issuance needs none (see "Issuance").
- `onSuccess(attributes)` – called with the disclosed attributes once a disclosure finished. Not called for an
  issuance: wallet-connect does not report whether the wallet collected the credential.
- `onFailed(outcome)` – optional; called when the user closes the dialog after a failure.
- `label` – button text (defaults to the wallet's own, in `lang`).
- `lang` – `"nl"` (default) or `"en"`.
- `helpBaseUrl` – optional; where "No app yet?" links point (defaults per wallet).
- `issuance` – put the registration's credential into the wallet instead of asking for data (see "Issuance").
- `sessionUrl`, `sessionBody` – optional; start the session through your own backend (see below).
- `useLocalWcServer` – talk to a wallet-connect server on localhost (development).
- `returnUrl` – where the wallet sends the user after a same-device disclosure (iframe support, see below).
  wallet-connect appends `?session_token=…` to it, so it must not have a query string or fragment itself. The
  default is the page's own address: set `returnUrl` when that address has a query string or fragment.
- `business` – Business Wallet instead of NP Wallet (other servers, colours and texts).
- `over18` – 18up instead of NP Wallet.
- `className`, `style`, `classes={{ button, label }}` – styling hooks for the button and its label; the stable class
  names are `.wcb-button` and `.wcb-button__label`.

Requires React 18 or 19. The dialog is rendered into `document.body` with `createPortal`.

### Issuance

```jsx
<WalletConnectButton issuance clientId="your-issuer-client-id" label="Add to your wallet" />
```

Add `business` for the Business Wallet. Each time the dialog opens, the button creates an issuance session at
wallet-connect (WE BUILD lane: `POST /api/issuance/sessions` on wallet-connect.eu, or bw.wallet-connect.eu for
`business`) and shows the links it hands out, as a QR code or, on a phone, as a link to the wallet app:

- an issuer that asks for an ID first hands out a presentation request (`openid4vp://`, a new one every few
  seconds); while the wallet answers it the dialog says to follow the steps in the app;
- then, or straight away for an issuer without an ID step, the credential offer (`openid-credential-offer://`),
  which works once and expires after about ten minutes. The session then stays open until it expires: the lane
  never reports whether the wallet collected the credential.

Closing the dialog before the offer was shown cancels the session. Once the offer was shown, closing leaves the
session alone (a wallet may still be collecting the credential) and ends the dialog as a plain close: `onFailed`
and `onSuccess` are not called. A short failure of the status requests leaves the offer on screen. The dialog
can still end on an error screen: when the session cannot be started (for example a client id the lane does not
know), when the ID step fails or is stopped, when more than three status requests in a row fail, or when the
offer expires on screen (after about ten minutes, even if the wallet collected it). Closing that screen calls
`onFailed`. No API key or backend is needed. A `session_token` in the page address belongs to a disclosure button: an issuance button
leaves it alone.

### Starting the session through your own backend

```jsx
<WalletConnectButton
  issuance
  clientId="your-issuer-client-id"
  sessionUrl="https://your-backend.example/api/issue/session"
  sessionBody={{ person: "N3" }}
/>
```

With `sessionUrl` the dialog does not create the session at wallet-connect itself: it POSTs `sessionBody` (JSON,
`{}` by default) to `sessionUrl`, expects wallet-connect's answer `{ session_token, status_url }` back, and then
follows `status_url` as usual (an absolute `status_url` is used as is, a relative one is resolved against
`sessionUrl`). Use it when your backend prepares the session first, for example to issue a credential with this
person's or company's data, or to start a disclosure with a secret API key. It works for issuance and disclosure
alike; for a disclosure the attributes are still fetched as described under `apiKey`, and your backend passes
the `return_url` to wallet-connect. A new `sessionBody` object with the same content (an inline object on every
render) keeps the button and an open dialog as they are.

The dialog waits up to 15 seconds for the answer (status requests get 5 seconds), then shows the network error
with a retry button. A session your backend still creates after that, or after the dialog was closed, is
cancelled as soon as its answer arrives (`DELETE` on its `status_url`) and never shown.

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
