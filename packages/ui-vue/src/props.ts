import type { DisclosedAttributesResponse, SessionOutcome } from "@wallet-connect/core"
import type { PropType } from "vue"

/** The 1.x props of the Vue button, unchanged. */
export const buttonProps = {
  label: { type: String, required: false },
  /** Current name for the registration's identifier; wins over `clientId`. */
  serviceId: { type: String, required: false },
  /** The original name for the same value, still fully supported. */
  clientId: { type: String, required: false },
  onSuccess: { type: Function as PropType<(attributes: DisclosedAttributesResponse) => void>, required: false },
  onFailed: { type: Function as PropType<(outcome: SessionOutcome) => void>, required: false },
  apiKey: { type: String, required: false },
  useLocalWcServer: { type: Boolean, default: false },
  business: { type: Boolean, default: false },
  lang: { type: String, default: "nl" },
  helpBaseUrl: { type: String, required: false },
  issuance: { type: Boolean, default: false },
  over18: { type: Boolean, default: false },
  /** @deprecated in the NP/BW/18up package: use the nb-wallet-connect-button-vue package. */
  nbwallet: { type: Boolean, default: false },
  /** Where the wallet sends the user after a same-device disclosure (iframe support). */
  returnUrl: { type: String, required: false },
  /**
   * Start the session through the page's own backend instead of wallet-connect: the dialog POSTs `sessionBody`
   * there as JSON and follows the `{ session_token, status_url }` it answers. For issuance and disclosure alike.
   */
  sessionUrl: { type: String, required: false },
  /** The JSON body of the `sessionUrl` request (default `{}`); any JSON value. */
  sessionBody: { type: null as unknown as PropType<unknown>, required: false },
} as const
