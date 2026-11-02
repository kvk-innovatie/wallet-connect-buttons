# nb-wallet-connect-button-vanillajs

Wallet Connect button for **NB Wallet** (shown to users as the **ZZP Garantie app**), talking to NB Wallet Connect (`connect.nbwallet.org`). Part of [wallet-connect-buttons](https://github.com/kvk-innovatie/wallet-connect-buttons).

## Usage from a CDN

```html
<script src="https://cdn.jsdelivr.net/npm/nb-wallet-connect-button-vanillajs@2/dist/nb-wallet-connect-button.js"></script>
<!-- or, without the embedded RO Sans fonts: .../dist/nb-wallet-connect-button.slim.js -->

<nb-wallet-connect-button
  service-id="your-service-id"
  api-key="your-api-key"
  label="Share data from your wallet"
  lang="en"
></nb-wallet-connect-button>

<script>
  const button = document.querySelector("nb-wallet-connect-button");
  button.addEventListener("success", (event) => console.log("attributes", event.detail));
  button.addEventListener("failed", (event) => console.log("failed", event.detail));
</script>
```

## Usage from npm

```bash
npm install nb-wallet-connect-button-vanillajs
```

```javascript
import "nb-wallet-connect-button-vanillajs"; // registers <nb-wallet-connect-button>; "nb-wallet-connect-button-vanillajs/slim" without the fonts
```

## Attributes

- `service-id` – the registration's identifier (NB Wallet Connect calls it a **service id**). `client-id` is the
  original name for the same value and still works; `service-id` wins when both are set.
- `api-key` – optional. With it the button calls the wallet-connect server directly; without it the page's own
  backend must proxy `/api/create-session` and `/api/disclosed-attributes` (see `examples/backends`).
- the `success` event carries the disclosed attributes in `event.detail`.
- the `failed` event fires when the user closes the dialog after a failure.
- `label` – button text (defaults to the wallet's own, in `lang`).
- `lang` – `"nl"` (default) or `"en"`.
- `help-base-url` – optional; where "No app yet?" links point (defaults per wallet).
- `issuance` – the session issues data to the wallet instead of asking for it.
- `use-local-wc-server` – talk to a wallet-connect server on localhost (development).
- `return-url` – where the wallet sends the user after a same-device disclosure (iframe support, see below).

Under the QR code the dialog offers the ZZP Garantie app download per role (director / employee) when a
`serviceId` is set, so a fresh install knows where the user came from.

Boolean attributes (`issuance`, `use-local-wc-server`, …) are set by their presence.

### Styling

The element uses a shadow root. Style the button with `::part`:

```css
nb-wallet-connect-button::part(button) { border-radius: 6px; padding: 12px 20px; }
nb-wallet-connect-button::part(button-span) { font-weight: bold; }
```

### Embedding in an iframe

Cross-device (QR code) works in an iframe as is. Same-device needs two things, because the wallet app returns
the user to a page and the button inside the iframe cannot see the address of the page around it:

1. Set `return-url` to the full address of the page that contains the iframe.
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

The button only accepts the message when it comes from the origin of `return-url`.

## Migrating from 1.x

| 1.x | 2.0 |
|---|---|
| `<wallet-connect-button nbwallet>` from the 1.x `wallet-connect-button-vanillajs` | `<nb-wallet-connect-button>` from this package |
| `nl-wallet-button::part(button)` | `nb-wallet-connect-button::part(button)` |
| `nl-wallet-button::part(button-span)` | `nb-wallet-connect-button::part(button-span)` |
| a web component inside a web component | one element, one shadow root |

Attributes and events are unchanged.

For further explanation and documentation, visit: https://wallet-connect.eu
