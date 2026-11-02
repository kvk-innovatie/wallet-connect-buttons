import vue from "@vitejs/plugin-vue"
import { libConfig } from "../../tooling/vite-lib.ts"

export default libConfig({
  root: import.meta.dirname,
  entries: { index: "src/index.ts", slim: "src/slim.ts" },
  external: ["vue"],
  plugins: [vue()],
})
