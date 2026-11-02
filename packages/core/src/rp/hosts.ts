import type { Brand } from "../brands/types"
import type { SessionType } from "../session/openid4vc"

export interface HostFlags {
  issuance?: boolean
  useLocalWcServer?: boolean
}

/** The wallet-connect server for a brand: issuance has its own host, local development its own ports. */
export const resolveHost = (brand: Brand, { issuance = false, useLocalWcServer = false }: HostFlags): string => {
  if (useLocalWcServer) return issuance ? brand.hosts.localIssuance : brand.hosts.localDisclosure
  return issuance ? brand.hosts.issuance : brand.hosts.disclosure
}

/** An explicit help-base-url wins; otherwise the brand's own help page. */
export const resolveHelpBaseUrl = (brand: Brand, helpBaseUrl?: string | null): URL =>
  new URL(helpBaseUrl || brand.helpBaseUrl)

/** The full return URL: the explicit one resolved against the document, else the document itself. */
export const resolveReturnUrl = (returnUrl: string | undefined | null, documentUrl: string): string =>
  returnUrl ? new URL(returnUrl, documentUrl).toString() : documentUrl

/**
 * Where the modal creates a session. `host` is the wallet-connect server when the page calls it
 * directly with an API key, or "" when the page's own backend proxies `/api/...`.
 */
export const buildStartUrl = (host: string, returnUrl: string): string =>
  `${host}/api/create-session?lang=en&return_url=${encodeURIComponent(returnUrl)}`

/** The fixed deep link of an issuance: the wallet fetches the request from the wallet-connect server itself. */
export const buildStaticUniversalLink = (
  brand: Brand,
  host: string,
  clientId: string,
  sessionType: SessionType,
): string => {
  const requestUri = `${host}/disclosure/${clientId}/request_uri?session_type=${sessionType}`
  const clientIdUri = `x509_san_dns:${new URL(host).hostname}`
  return `${brand.deepLinkScheme}/disclosure_based_issuance?request_uri=${encodeURIComponent(requestUri)}&request_uri_method=post&client_id=${clientIdUri}`
}

export const buildStaticUniversalLinks = (
  brand: Brand,
  host: string,
  clientId: string,
): { sameDeviceUl: URL; crossDeviceUl: URL } => ({
  sameDeviceUl: new URL(buildStaticUniversalLink(brand, host, clientId, "same_device")),
  crossDeviceUl: new URL(buildStaticUniversalLink(brand, host, clientId, "cross_device")),
})
