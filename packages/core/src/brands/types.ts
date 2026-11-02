import type { StoreLinks } from "../store_links"
import type { DictionaryOverrides, Language } from "../translations"

export type BrandId = "np" | "bw" | "up18" | "nb"

/** Everything that differs between the wallets a button can talk to. */
export interface Brand {
  id: BrandId
  /** Product name, used as the dialog's accessible label. */
  name: string
  /** Class on the modal root that selects the brand's colours and logo in the stylesheet. */
  cssClass: string
  translations: Partial<Record<Language, DictionaryOverrides>>
  /** Wallet-connect servers: remote and local, for disclosure and issuance. */
  hosts: {
    disclosure: string
    issuance: string
    localDisclosure: string
    localIssuance: string
  }
  /** Scheme + host the static issuance links open the wallet app with. */
  deepLinkScheme: string
  /** NB Wallet Connect renamed the registration id to "service id" throughout its API. */
  idParam: "client_id" | "service_id"
  idPath: "client" | "service"
  /** Default "No app yet?" link; an explicit helpBaseUrl option wins. */
  helpBaseUrl: string
  /** Store listings. Only brands with store links show the director/employee/holder download badges. */
  store?: StoreLinks
}
