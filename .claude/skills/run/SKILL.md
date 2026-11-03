---
name: run
description: Launch the example apps (React, Vue, vanilla) against the mock wallet-connect server and screenshot the wallet dialog with the system Chrome. Use to see a styling or behaviour change in the real popup.
---

# Run the examples and screenshot the popup

The examples import the *built* packages, so build first after any change under `packages/`.

## 1. Build and start (four servers)

```bash
npm run build
for p in 5021 5031 5032 5033; do lsof -ti:$p -sTCP:LISTEN | xargs -r kill; done   # free the ports first
S=<scratch dir>
(npm run mock:wallet-connect > $S/mock.log 2>&1 &)    # fake wallet-connect, port 5021
(npm run dev:react          > $S/react.log 2>&1 &)    # Vite, port 5032
(npm run dev:vue            > $S/vue.log 2>&1 &)      # Vite, port 5033
(npm run dev:vanilla        > $S/vanilla.log 2>&1 &)  # Express, port 5031, serves the built vanillajs dist
timeout 60 bash -c 'for p in 5021 5031 5032 5033; do until curl -s -o /dev/null http://localhost:$p; do sleep 1; done; done'
```

The Vite servers do not pick up a rebuilt `dist/` reliably: after `npm run build`, kill and restart 5031-5033.

`MOCK_OUTCOME=FAILED` (or `EXPIRED`, `CANCELLED`) before the mock command shows the error screens.

## 2. Browser driver (one-time per scratch dir)

No Playwright or chromium-cli is installed. Use `playwright-core` with the system Chrome at `/usr/bin/google-chrome`:

```bash
mkdir -p $S/driver && cd $S/driver && npm init -y >/dev/null && npm install playwright-core@1.52.0
```

## 3. Screenshot

```bash
mkdir -p $S/shots
DRIVER_DIR=$S/driver node .claude/skills/run/shoot.mjs $S/shots            # all three demos
DRIVER_DIR=$S/driver node .claude/skills/run/shoot.mjs $S/shots vanilla    # one demo
```

Output per demo: `<name>-1-page.png` (page), `<name>-2..6-popup.png` (dialog over time: QR screen, then "Follow the steps"
once the mock advances the session). The script also prints the dialog's computed `display`, `backgroundColor`,
`maxWidth` and `borderRadius` and the console errors. Healthy values: `flex`, `rgb(255, 255, 255)`, `500px`, `8px`.

**Look at the PNGs** (Read tool). A dialog without a white card, or child blocks stretched to the full viewport width,
means the stylesheet's reset is overriding `.wcb-modal` again (see the comment at the top of
`packages/core/src/styles/wallet.css`).

## Gotchas

- The vanilla demo logs one 404: the page has no favicon. Ignore it.
- SVG errors like `<path> attribute d: Expected moveto path command` mean an icon *name* was passed where a path was
  expected (the footer actions in `@wallet-connect/core` name their icon; UIs must look it up in `ICONS`).
- The vanilla dialog is in a shadow root. Playwright locators pierce it; `document.querySelector` does not.
- Do not use `pkill -f node`: it kills the session. Kill by port as above.
