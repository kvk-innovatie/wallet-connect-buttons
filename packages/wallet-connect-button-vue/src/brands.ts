import { bw, np, up18, type BrandSet } from "@wallet-connect/core"

/** NP Wallet by default; `business` and `over18` switch to Business Wallet and 18up. */
export const brands: BrandSet = { default: np, business: bw, over18: up18 }
export const nbwalletWarning = "wallet-connect-button-vue: the nbwallet prop is deprecated here and will be removed in 3.0; use the nb-wallet-connect-button-vue package for NB Wallet / ZZP Garantie."
