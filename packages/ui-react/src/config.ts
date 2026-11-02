import type { BrandSet, Fetch } from "@wallet-connect/core"

/** What a public package fixes when it creates its component: which wallets, fonts, test hooks. */
export interface ButtonConfig {
  brands: BrandSet
  /** Register the RO Sans font faces on the page (default entry) or not (slim entry). */
  fonts?: boolean
  /** Alternative fetch, mainly for tests. */
  fetch?: Fetch
  /** Shown once when `nbwallet` is used on a package that has no NB brand. */
  nbwalletWarning?: string
}
