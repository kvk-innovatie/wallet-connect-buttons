import type { Brand } from "./types"

export type { Brand, BrandId } from "./types"
export { np } from "./np"
export { bw } from "./bw"
export { up18 } from "./up18"

/** The boolean props the 1.x buttons used to pick a wallet. */
export interface BrandFlags {
  business?: boolean
  over18?: boolean
  nbwallet?: boolean
}

/** A package's brands: the default plus the ones its flags can switch to. */
export interface BrandSet {
  default: Brand
  business?: Brand
  over18?: Brand
}

/** The brand for a set of flags, with the 1.x precedence (over18 before business). `nbwallet` is accepted but has
 * no brand here: the NB Wallet buttons live in nb-wallet-connect-buttons. */
export const selectBrand = (brands: BrandSet, flags: BrandFlags): Brand => {
  if (flags.over18 && brands.over18) return brands.over18
  if (flags.business && brands.business) return brands.business
  return brands.default
}
