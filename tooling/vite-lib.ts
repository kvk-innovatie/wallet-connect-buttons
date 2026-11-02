import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, type LibraryFormats, type PluginOption, type UserConfig } from "vite"

export interface LibOptions {
  /** The package directory (`import.meta.dirname`). */
  root: string
  /** Entry name -> source file, e.g. { index: "src/index.ts", slim: "src/slim.ts" }. */
  entries: Record<string, string>
  /** Packages left to the consumer (React, Vue). Everything else, including @wallet-connect/*, is bundled. */
  external?: (string | RegExp)[]
  formats?: LibraryFormats[]
  plugins?: PluginOption[]
  /** Fixed output file name (CDN builds). */
  fileName?: string
  /** Global name for an IIFE build. */
  name?: string
  emptyOutDir?: boolean
}

/**
 * Shared Vite library configuration of the public button packages. Declarations are not emitted
 * here but by tooling/emit-types.mjs (tsc / vue-tsc), which the packages' build scripts run next.
 */
export const libConfig = (opts: LibOptions): UserConfig => {
  const pkg = JSON.parse(readFileSync(resolve(opts.root, "package.json"), "utf8")) as { version: string }
  const formats = opts.formats ?? ["es", "cjs"]
  return defineConfig({
    plugins: [...(opts.plugins ?? [])],
    define: {
      __WCB_VERSION__: JSON.stringify(pkg.version),
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
      target: "es2020",
      sourcemap: true,
      minify: formats.includes("iife"),
      emptyOutDir: opts.emptyOutDir ?? true,
      lib: {
        entry: Object.fromEntries(Object.entries(opts.entries).map(([k, v]) => [k, resolve(opts.root, v)])),
        formats,
        name: opts.name,
        fileName: opts.fileName
          ? () => opts.fileName as string
          : (format, name) => `${name}.${format === "es" ? "js" : format === "cjs" ? "cjs" : `${format}.js`}`,
      },
      rollupOptions: {
        external: opts.external ?? [],
        output: { exports: "named" },
      },
    },
  })
}
