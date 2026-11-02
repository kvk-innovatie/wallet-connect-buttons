import type { SVGProps } from "react"

type Paths = string | readonly string[] | ReadonlyArray<readonly [string, string]>

/** One of the dialog's icons: a path, several paths, or [fill, path] pairs (Google Play). */
export const Icon = ({ d, size = 16, width, height, viewBox = "0 0 24 24", ...rest }: { d: Paths; size?: number; width?: number; height?: number; viewBox?: string } & Omit<SVGProps<SVGSVGElement>, "d" | "width" | "height" | "viewBox">) => {
  const paths = typeof d === "string" ? [d] : d
  return (
    <svg width={width ?? size} height={height ?? size} fill="currentColor" viewBox={viewBox} {...rest}>
      {paths.map((p, i) => (typeof p === "string" ? <path key={i} d={p} /> : <path key={i} fill={p[0]} d={p[1]} />))}
    </svg>
  )
}
