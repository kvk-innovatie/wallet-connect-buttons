import { bw, np, up18, type BrandSet } from "@wallet-connect/core"

/** NP Wallet by default; `business` and `over18` switch to Business Wallet and 18up. */
export const brands: BrandSet = { default: np, business: bw, over18: up18 }
export const nbwalletWarning = "<wallet-connect-button>: the nbwallet attribute is deprecated here and will be removed in 3.0; use the nb-wallet-connect-button-vanillajs package (<nb-wallet-connect-button>) for NB Wallet / ZZP Garantie."
export const TAG_NAME = "wallet-connect-button"
