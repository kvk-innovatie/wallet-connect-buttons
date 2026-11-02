import type { BrandSet, Fetch } from "@wallet-connect/core"

/** What a public package fixes when it creates its component: which wallets, fonts, test hooks. */
export interface ButtonConfig {
  brands: BrandSet
  /** Registers font faces on the page (the default entry passes core/fonts ensureFonts; the slim entry nothing). */
  fonts?: (doc: Document) => void
  /** Alternative fetch, mainly for tests. */
  fetch?: Fetch
  /** Shown once when `nbwallet` is used on a package that has no NB brand. */
  nbwalletWarning?: string
}

/** Configs whose `nbwalletWarning` has been shown; one warning per package, not per button instance. */
export const warnedConfigs = new WeakSet<ButtonConfig>()
