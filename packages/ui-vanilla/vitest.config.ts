import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "ui-vanilla",
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },
})
