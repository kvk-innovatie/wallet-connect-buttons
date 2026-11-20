import type { Brand } from "./types"

/** NP Wallet: the base strings and styling. */
export const np: Brand = {
  id: "np",
  name: "NP Wallet",
  cssClass: "",
  translations: {},
  hosts: {
    disclosure: "https://wallet-connect.eu",
    // static flow only: answers 410 since wallet-connect.eu moved to the WE BUILD lane
    issuance: "https://issuance.wallet-connect.eu",
    localDisclosure: "http://localhost:5021",
    localIssuance: "http://localhost:5007",
  },
  // issuance sessions on wallet-connect.eu (WE BUILD lane)
  issuanceFlow: "lane",
  deepLinkScheme: "walletdebuginteraction://wallet.edi.rijksoverheid.nl",
  idParam: "client_id",
  idPath: "client",
  helpBaseUrl: "https://npwallet.org/",
}
