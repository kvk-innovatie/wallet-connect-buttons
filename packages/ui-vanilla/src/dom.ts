type Child = Node | string | null | undefined | false
type Attrs = Record<string, string | boolean | number | null | undefined | EventListener>

/** Create an element with attributes (`on*` keys become listeners) and children. */
export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (value === true) {
      el.setAttribute(key, "")
    } else {
      el.setAttribute(key, String(value))
    }
  }
  append(el, children)
  return el
}

export const append = (parent: Node, children: Child[]): void => {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child)
  }
}

const SVG_NS = "http://www.w3.org/2000/svg"

/** An inline icon: one or more paths on a viewBox, `fill="currentColor"` unless a path brings its own. */
export const svg = (
  paths: string | readonly string[] | ReadonlyArray<readonly [string, string]>,
  opts: { size?: number | [number, number]; viewBox?: string; className?: string; ariaHidden?: boolean; role?: string; label?: string } = {},
): SVGSVGElement => {
  const el = document.createElementNS(SVG_NS, "svg")
  const [w, hgt] = Array.isArray(opts.size) ? opts.size : [opts.size ?? 16, opts.size ?? 16]
  el.setAttribute("width", String(w))
  el.setAttribute("height", String(hgt))
  el.setAttribute("fill", "currentColor")
  el.setAttribute("viewBox", opts.viewBox ?? "0 0 24 24")
  if (opts.className) el.setAttribute("class", opts.className)
  if (opts.ariaHidden) el.setAttribute("aria-hidden", "true")
  if (opts.role) el.setAttribute("role", opts.role)
  if (opts.label) el.setAttribute("aria-label", opts.label)
  const list = typeof paths === "string" ? [paths] : paths
  for (const p of list) {
    const path = document.createElementNS(SVG_NS, "path")
    if (typeof p === "string") {
      path.setAttribute("d", p)
    } else {
      path.setAttribute("fill", p[0])
      path.setAttribute("d", p[1])
    }
    el.appendChild(path)
  }
  return el
}
