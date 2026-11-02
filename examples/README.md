# Examples

| Folder | What | Run |
|---|---|---|
| `react/` | Vite + React demo of every button variant | `npm run dev:react` (root) |
| `vue/` | Vite + Vue demo | `npm run dev:vue` |
| `vanilla/` | plain HTML page using the built `<wallet-connect-button>` element, with a tiny Express server that also proxies `/api/*` | `npm run build && npm run dev:vanilla` |
| `static/` | one-file HTML pages per use case, loading the buttons from the npm CDN | open in a browser (served at `/static/...` by the vanilla server) |
| `backends/nodejs`, `backends/python` | backend proxies that add the API key server-side ("secure, via backend") | `npm run backend:node`, or see `backends/python` |
| `mock-wallet-connect/` | a fake wallet-connect server on port 5021 (the `useLocalWcServer` port) that walks a session to DONE by itself | `npm run mock:wallet-connect` |

To try a button without a wallet: start the mock, then any example; use the "local Wallet-Connect server"
buttons. Set `MOCK_OUTCOME=FAILED` (or `EXPIRED`, `CANCELLED`) to see the error screens.

The API keys and ids in the examples are demo registrations and deliberately public.
