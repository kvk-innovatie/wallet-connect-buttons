import type { Brand } from "./types"

/** NP Wallet: the base strings and styling. */
export const np: Brand = {
  id: "np",
  name: "NP Wallet",
  cssClass: "",
  translations: {},
  hosts: {
    disclosure: "https://wallet-connect.eu",
    issuance: "https://issuance.wallet-connect.eu",
    localDisclosure: "http://localhost:5021",
    localIssuance: "http://localhost:5007",
  },
  deepLinkScheme: "walletdebuginteraction://wallet.edi.rijksoverheid.nl",
  idParam: "client_id",
  idPath: "client",
  helpBaseUrl: "https://npwallet.org/",
}
