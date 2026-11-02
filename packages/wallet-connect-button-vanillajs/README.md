# wallet-connect-button-vanillajs

Wallet Connect button for **NP Wallet**, **Business Wallet** and **18up**. Part of [wallet-connect-buttons](https://github.com/kvk-innovatie/wallet-connect-buttons). For NB Wallet / ZZP Garantie use the `nb-wallet-connect-button-*` packages.

## Usage from a CDN

```html
<script src="https://cdn.jsdelivr.net/npm/wallet-connect-button-vanillajs@2/dist/wallet-connect-button.js"></script>
<!-- or, without the embedded RO Sans fonts: .../dist/wallet-connect-button.slim.js -->

<wallet-connect-button
  service-id="your-service-id"
  api-key="your-api-key"
  label="Share data from your wallet"
  lang="en"
></wallet-connect-button>

<script>
  const button = document.querySelector("wallet-connect-button");
  button.addEventListener("success", (event) => console.log("attributes", event.detail));
  button.addEventListener("failed", (event) => console.log("failed", event.detail));
</script>
```

## Usage from npm

```bash
npm install wallet-connect-button-vanillajs
```

```javascript
import "wallet-connect-button-vanillajs"; // registers <wallet-connect-button>; "wallet-connect-button-vanillajs/slim" without the fonts
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
- `business` – Business Wallet instead of NP Wallet (other servers, colours and texts).
- `over18` – 18up instead of NP Wallet.
Boolean attributes (`issuance`, `use-local-wc-server`, …) are set by their presence.

### Styling

The element uses a shadow root. Style the button with `::part`:

```css
wallet-connect-button::part(button) { border-radius: 6px; padding: 12px 20px; }
wallet-connect-button::part(button-span) { font-weight: bold; }
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
| `https://cdn.jsdelivr.net/gh/kvk-innovatie/wallet-connect-button-vanillajs@v1.0.x/wallet-connect-button.js` | `https://cdn.jsdelivr.net/npm/wallet-connect-button-vanillajs@2/dist/wallet-connect-button.js` |
| `nl-wallet-button::part(button)` | `wallet-connect-button::part(button)` |
| `nl-wallet-button::part(button-span)` | `wallet-connect-button::part(button-span)` |
| a web component inside a web component | one element, one shadow root |

The old `gh/` URLs keep working for the 1.x versions they pin. Attributes and events are unchanged.

For further explanation and documentation, visit: https://wallet-connect.eu
