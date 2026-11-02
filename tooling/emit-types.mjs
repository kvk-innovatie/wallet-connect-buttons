// Emit the declaration tree of a public package into its dist/ with tsc (or vue-tsc), then turn the
// bare `@wallet-connect/*` specifiers into relative paths inside that tree, so consumers never need
// the private workspace packages.
//
//   node tooling/emit-types.mjs <package dir> [--vue]
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

const [pkgDir, ...flags] = process.argv.slice(2)
const root = resolve(pkgDir)
const compiler = flags.includes("--vue") ? "vue-tsc" : "tsc"
const bin = resolve(root, "../../node_modules/.bin", compiler)

execFileSync(bin, ["-p", resolve(root, "tsconfig.types.json")], { stdio: "inherit" })

const dist = resolve(root, "dist")
const targets = {
  "@wallet-connect/core/fonts": join(dist, "core/src/fonts/inject"),
  "@wallet-connect/core": join(dist, "core/src/index"),
  "@wallet-connect/ui-react": join(dist, "ui-react/src/index"),
  "@wallet-connect/ui-vue": join(dist, "ui-vue/src/index"),
  "@wallet-connect/ui-vanilla": join(dist, "ui-vanilla/src/index"),
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".d.ts") ? [path] : []
  })

let rewritten = 0
for (const file of walk(dist)) {
  const source = readFileSync(file, "utf8")
  const out = source.replace(/(['"])@wallet-connect\/(core\/fonts|core|ui-react|ui-vue|ui-vanilla)\1/g, (_m, q, name) => {
    let rel = relative(dirname(file), targets[`@wallet-connect/${name}`]).replace(/\\/g, "/")
    if (!rel.startsWith(".")) rel = `./${rel}`
    rewritten += 1
    return `${q}${rel}${q}`
  })
  if (out !== source) writeFileSync(file, out)
}
console.log(`types: ${compiler} emitted into ${relative(process.cwd(), dist)}, ${rewritten} specifiers made relative`)
