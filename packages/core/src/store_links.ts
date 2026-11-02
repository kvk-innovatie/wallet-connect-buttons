import { type InstallRole } from "./session/state"

/** Where a brand's app can be installed. */
export interface StoreLinks {
  appStoreUrl: string
  playStoreBaseUrl: string
}

// `any`: a desktop, which cannot know which phone the user has; the badge then
// leads to the install QR code instead of a store.
export type Store = "apple" | "google" | "any"

/** The store badge to show for the device the page is open on. */
export const storeForDevice = (isMobile: boolean, isAndroid: boolean): Store =>
  !isMobile ? "any" : isAndroid ? "google" : "apple"

/** Query of a relying-party onboarding link: where the user came from, and as what. */
export const onboardingParams = (serviceId: string, role: InstallRole): Record<string, string> => ({
  service_id: serviceId,
  role,
})

/**
 * Play listing carrying the onboarding link as install `referrer`, so a fresh
 * install can pick up the service id and role (deferred deep link). The pairs
 * are joined unencoded and the whole referrer is encoded once, which is what
 * the app's install-referrer parser expects.
 */
export const playStoreUrl = (playStoreBaseUrl: string, params: Record<string, string>): string => {
  const referrer = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&")
  return `${playStoreBaseUrl}&referrer=${encodeURIComponent(referrer)}`
}

/** Direct store link for the phone the page is open on. The App Store cannot carry a referrer. */
export const storeUrl = (links: StoreLinks, store: Store, params: Record<string, string>): string =>
  store === "google" ? playStoreUrl(links.playStoreBaseUrl, params) : links.appStoreUrl

/**
 * Universal link `/deeplink/onboarding?service_id=…&role=…` on the help-base-url
 * origin (its path and query are replaced, not preserved). On a phone with the
 * app installed the OS opens the app with the service id and role; otherwise
 * nginx serves the download page at this URL. With `toStore`, the download
 * page sends the phone straight on to its app store (`store=1`), which is what
 * the QR code shown on a desktop wants: scan with the camera, land in the store.
 */
export const onboardingLink = (helpBaseUrl: URL, serviceId: string, role: InstallRole, toStore = false): URL => {
  const u = new URL("/deeplink/onboarding", helpBaseUrl)
  u.searchParams.set("service_id", serviceId)
  u.searchParams.set("role", role)
  if (toStore) u.searchParams.set("store", "1")
  return u
}
