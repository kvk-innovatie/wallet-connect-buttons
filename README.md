# wallet-connect-buttons

Wallet Connect buttons for **NP Wallet**, **Business Wallet** and **18up**, for React, Vue and plain
HTML/JavaScript, plus example apps, demo backends and a mock wallet-connect server.

The NB Wallet / ZZP Garantie buttons live in their own repository and packages
(`nb-wallet-connect-button-{react,vue,vanillajs}`); see [PORTING.md](PORTING.md) for how the two repositories
relate.

| Package | For | Install |
|---|---|---|
| [`wallet-connect-button-react`](packages/wallet-connect-button-react) | React 18 / 19 | `npm i wallet-connect-button-react` |
| [`wallet-connect-button-vue`](packages/wallet-connect-button-vue) | Vue 3 | `npm i wallet-connect-button-vue` |
| [`wallet-connect-button-vanillajs`](packages/wallet-connect-button-vanillajs) | any page, `<wallet-connect-button>` | `<script src="https://cdn.jsdelivr.net/npm/wallet-connect-button-vanillajs@2/dist/wallet-connect-button.js">` |

Each package README documents the props/attributes and the 1.x → 2.0 migration; [CHANGELOG.md](CHANGELOG.md)
lists the breaking changes.

## How it is built

```
packages/
  core/          framework-agnostic: brands, the session state machine, the relying-party logic,
                 the dialog's view model, styles, QR code, texts (private, bundled into the packages)
  ui-vanilla/    plain-DOM renderer + custom element factory       (private)
  ui-vue/        the dialog as Vue components                      (private)
  ui-react/      the dialog as React components                    (private)
  wallet-connect-button-{react,vue,vanillajs}/   the published packages: a brand set + a UI
examples/        react, vue and vanilla demo apps, static pages, demo backends, mock-wallet-connect
scripts/         release.sh (lockstep release), sync-from-wallet-web.sh (pull upstream wallet_web changes)
tooling/         shared Vite library build
```

The private packages are source only; each public package's Vite build inlines them. All public packages
share one version and are released together.

## Development

```bash
npm install
npm test                 # vitest, all packages
npm run typecheck
npm run build            # the public packages (dist/)
npm run mock:wallet-connect   # fake wallet-connect server on :5021
npm run dev:react        # or dev:vue; dev:vanilla serves examples/vanilla + the built elements
```

See [examples/README.md](examples/README.md) for running the demos against the mock, a local
wallet-connect server or the remote hosts.

## Releasing

`scripts/release.sh patch|minor|major [--dry-run]`: typecheck, test, build, bump every public package to the
same version, publish to npm, commit, tag `vX.Y.Z`, push. Needs an npm login with publish rights.

## Keeping up with wallet_web

The dialog is a port of `wallet_web` (the Vue web component in the wallet repositories, upstream
[nl-wallet](https://github.com/MinBZK/nl-wallet)). `scripts/sync-from-wallet-web.sh` copies the
framework-agnostic files and lists what changed upstream in the hand-ported ones; `packages/core/UPSTREAM.txt`
records the last synced commit.

## History

This repository replaced five repositories (`wallet-connect-button-react`, `-vue`, `-vanillajs` and two
example apps). Their histories are imported under `packages/` and `examples/`; the 1.x release tags are
prefixed `react-`, `vue-`, `vanilla-`.
