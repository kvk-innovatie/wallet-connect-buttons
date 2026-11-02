import { defaultFetch, type Fetch } from "../session/api"
import type { Brand } from "../brands/types"

export interface AttributeData {
  age_over_18?: boolean
  [key: string]: unknown
}

export interface DisclosedAttributesResponse {
  attributes?: {
    [key: string]: {
      attributes?: { [key: string]: AttributeData }
      issuerUri?: string
      ca?: string
      validityInfo?: { signed?: string; validFrom?: string; validUntil?: string }
    }
  }
  [key: string]: unknown
}

export interface DisclosedAttributesRequest {
  /** Wallet-connect server; only used when the page holds an API key, otherwise the page's own backend proxies. */
  host: string
  apiKey?: string
  idParam: Brand["idParam"]
  clientId: string
  sessionToken: string
  nonce?: string
}

export const disclosedAttributesUrl = (r: DisclosedAttributesRequest): string => {
  const base = r.apiKey ? r.host : ""
  let url = `${base}/api/disclosed-attributes?session_token=${encodeURIComponent(r.sessionToken)}&${r.idParam}=${encodeURIComponent(r.clientId)}`
  if (r.nonce) url += `&nonce=${encodeURIComponent(r.nonce)}`
  return url
}

export const authHeaders = (apiKey?: string): Record<string, string> =>
  apiKey ? { Authorization: `Bearer ${apiKey}` } : {}

/** The attributes the wallet disclosed in a finished session. Rejects with an Error carrying the HTTP status. */
export const fetchDisclosedAttributes = async <T = DisclosedAttributesResponse>(
  r: DisclosedAttributesRequest,
  fetch: Fetch = defaultFetch,
): Promise<T> => {
  const response = await fetch(disclosedAttributesUrl(r), { headers: authHeaders(r.apiKey) })
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
  return (await response.json()) as T
}
