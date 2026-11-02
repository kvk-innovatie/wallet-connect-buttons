import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    name: "ui-react",
    environment: "happy-dom",
    include: ["test/**/*.test.tsx"],
    setupFiles: ["test/setup.ts"],
  },
})
