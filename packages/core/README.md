# @wallet-connect/core

Framework-agnostic core of the wallet-connect buttons. Private: it is bundled into the public packages, never
published on its own.

- `brands/` – one object per wallet (NP Wallet, Business Wallet, 18up, NB Wallet): servers, deep-link scheme,
  id parameter name, help page, texts, store links.
- `session/` – `WalletSession`, the dialog's state machine (create session, poll status, choose device, stop,
  retry), and `StaticSession` for issuance links. `api.ts` does the three server calls with `fetch`.
- `rp/` – the relying-party side the buttons share: `WalletConnectController` (host resolution, session token
  from URL or iframe message, disclosed attributes, requested credentials), plus the pure helpers it is built from.
- `qr/`, `i18n/`, `styles/`, `fonts/` – vendored from `wallet_web` (see `UPSTREAM.txt` for the commit).

`npm test` runs the vitest suite in `test/`.
