import type { Brand } from "../brands/types"
import type { SessionType } from "../session/openid4vc"

export interface HostFlags {
  issuance?: boolean
  useLocalWcServer?: boolean
}

/** Whether the brand's issuance buttons use wallet-connect's issuance sessions (the WE BUILD lane). */
export const usesIssuanceLane = (brand: Brand): boolean => brand.issuanceFlow === "lane"

/**
 * The wallet-connect server for a brand, local development on its own ports. A static issuance has its
 * own host; on the WE BUILD lane issuance is part of wallet-connect's own API, the disclosure host.
 */
export const resolveHost = (brand: Brand, { issuance = false, useLocalWcServer = false }: HostFlags): string => {
  const staticIssuance = issuance && !usesIssuanceLane(brand)
  if (useLocalWcServer) return staticIssuance ? brand.hosts.localIssuance : brand.hosts.localDisclosure
  return staticIssuance ? brand.hosts.issuance : brand.hosts.disclosure
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

/**
 * Where the modal creates an issuance session on the WE BUILD lane. Always wallet-connect itself: the
 * lane's issuance API needs no API key, so there is no backend proxy for it.
 */
export const buildIssuanceStartUrl = (host: string, lang: string): string =>
  `${host}/api/issuance/sessions?lang=${encodeURIComponent(lang)}`

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
