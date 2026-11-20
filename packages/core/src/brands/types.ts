import type { StoreLinks } from "../store_links"
import type { DictionaryOverrides, Language } from "../translations"

export type BrandId = "np" | "bw" | "up18"

/** Everything that differs between the wallets a button can talk to. */
export interface Brand {
  id: BrandId
  /** Product name, used as the dialog's accessible label. */
  name: string
  /** Class on the modal root that selects the brand's colours and logo in the stylesheet. */
  cssClass: string
  translations: Partial<Record<Language, DictionaryOverrides>>
  /**
   * Wallet-connect servers, remote and local. `disclosure` is wallet-connect's own API; `issuance` and
   * `localIssuance` are only used by the static issuance flow.
   */
  hosts: {
    disclosure: string
    issuance: string
    localDisclosure: string
    localIssuance: string
  }
  /**
   * How an issuance button gets its links (default "static"):
   * - "lane": wallet-connect's issuance sessions on the disclosure host (the WE BUILD lane): the dialog
   *   creates a session and shows the links its status hands out (an ID-step request, then the credential offer);
   * - "static": the fixed `disclosure_based_issuance` links on the issuance host (the NL stack).
   */
  issuanceFlow?: "lane" | "static"
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
