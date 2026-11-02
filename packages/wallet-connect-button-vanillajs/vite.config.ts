import { libConfig } from "../../tooling/vite-lib.ts"

// Three builds: ESM/CJS entries with types, and two self-registering IIFE files for a <script> tag
// (served by jsDelivr/unpkg from npm): with and without the embedded fonts.
export default ({ mode }: { mode: string }) => {
  if (mode === "cdn" || mode === "cdn-slim") {
    const slim = mode === "cdn-slim"
    return libConfig({
      root: import.meta.dirname,
      entries: { cdn: slim ? "src/slim.ts" : "src/index.ts" },
      formats: ["iife"],
      name: "WalletConnectButton",
      fileName: slim ? "wallet-connect-button.slim.js" : "wallet-connect-button.js",
      emptyOutDir: false,
    })
  }
  return libConfig({
    root: import.meta.dirname,
    entries: { index: "src/index.ts", slim: "src/slim.ts" },
  })
}
