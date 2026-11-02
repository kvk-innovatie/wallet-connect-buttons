# wallet-connect-buttons

Wallet Connect buttons for NP Wallet, Business Wallet and 18up, for React, Vue and plain HTML/JavaScript, plus
example apps and backends. This repository replaces five separate repositories; their full histories were imported
under `packages/` and `examples/` (old release tags are prefixed `react-`, `vue-`, `vanilla-`).

## Layout

| Path | What |
|---|---|
| `packages/wallet-connect-button-react` | npm `wallet-connect-button-react` |
| `packages/wallet-connect-button-vue` | npm `wallet-connect-button-vue` |
| `packages/wallet-connect-button-vanillajs` | `<wallet-connect-button>` web component (jsDelivr) |
| `vendor/nl-wallet-web.js` | the one vendored `wallet_web` build (`<nl-wallet-button>`) all three packages bundle |
| `examples/react`, `examples/vue` | demo apps |
| `examples/backends/nodejs`, `examples/backends/python` | demo backend proxies shared by the example apps |
| `examples/static` | static demo pages |
| `scripts/update-nl-wallet-web.sh` | rebuilds `wallet_web` in `../business-wallet` and refreshes `vendor/nl-wallet-web.js` |
| `scripts/publish-all-buttons.sh` | runs each package's publish script |

## Development

npm workspaces; one `npm install` at the root installs everything.

```bash
npm install
npm run build          # the three button packages
npm run typecheck
npm run dev:react      # or dev:vue, dev:vanilla
npm run backend:node   # demo proxy on http://localhost:5030
```

Each package keeps its own README with the integration API.
