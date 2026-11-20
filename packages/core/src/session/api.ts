import type { ErrorType } from "./state"
import type { SessionType, StatusResponse } from "./openid4vc"
import type { SessionOptions, SessionResponse } from "./relying_party"

/**
 * How long a status request or a cancel may take: half of the currently configured expiration time of the
 * ephemeral session ID included in the session URL.
 */
export const REQUEST_TIMEOUT = 5000

/**
 * How long the dialog waits for a session start (the POST to wallet-connect, or to the page's own `sessionUrl`)
 * before it shows the network error. Longer than `REQUEST_TIMEOUT`: a page's backend may legitimately need
 * several seconds, e.g. to wait for a lock and then make a few calls to wallet-connect. The request itself stays
 * open until `START_REQUEST_TIMEOUT`, so that a session created after the dialog gave up is still cancelled.
 */
export const START_TIMEOUT = 15000

/**
 * When the session start request itself is aborted: a safety net well above `START_TIMEOUT`. An answer that
 * arrives in between is only used to cancel the session it created; the dialog never shows it.
 */
export const START_REQUEST_TIMEOUT = 60000

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/** The three calls a session makes to the wallet-connect server. Injectable, so tests need no network. */
export interface SessionApi {
  /**
   * POST `body` as JSON: wallet-connect's `SessionOptions` (`{ usecase }`), or whatever the page's own
   * backend expects. Both answer `{ session_token, status_url }`. `fetchApi` waits up to
   * `START_REQUEST_TIMEOUT` for the answer; `WalletSession` stops waiting at `START_TIMEOUT`.
   */
  createSession(url: URL, body: SessionOptions | unknown): Promise<SessionResponse>
  getStatus(url: URL, sessionType: SessionType): Promise<StatusResponse>
  cancelSession(url: URL): Promise<void>
}

const FAILED: ErrorType = "failed"
const NETWORK: ErrorType = "network"

export const defaultFetch: Fetch = (input, init) => globalThis.fetch(input, init)

/**
 * One request, aborted after `timeout` ms. Rejects with an `ErrorType`: "network" when the
 * request timed out or never reached a server, "failed" for every other problem.
 */
const request = async <T>(
  fetch: Fetch,
  url: URL,
  init: RequestInit,
  parse: (response: Response) => Promise<T>,
  timeout = REQUEST_TIMEOUT,
): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url.toString(), { ...init, signal: controller.signal })
    if (!response.ok) {
      console.error(`${init.method} ${url} -> ${response.status}`)
      throw FAILED
    }
    return await parse(response)
  } catch (e) {
    if (e === FAILED) throw e
    console.error(e)
    // our own abort, or fetch's TypeError for "could not connect"
    if (controller.signal.aborted || e instanceof TypeError) throw NETWORK
    throw FAILED
  } finally {
    clearTimeout(timer)
  }
}

/** A URL from a server's answer, resolved against `base`; null when it is missing or not a URL. */
const parseUrl = (value: unknown, base: URL): URL | null => {
  if (typeof value !== "string" || value === "") return null
  try {
    return new URL(value, base)
  } catch {
    return null
  }
}

export const fetchApi = (fetch: Fetch = defaultFetch): SessionApi => ({
  createSession: (url, body) =>
    request(
      fetch,
      url,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      async (response) => {
        const data = await response.json()
        // the server sends strings; a relative status_url is resolved against the start url
        const statusUrl = parseUrl(data?.status_url, url)
        if (!statusUrl) {
          console.error(`POST ${url} -> no status_url`)
          throw FAILED
        }
        return { status_url: statusUrl, session_token: typeof data.session_token === "string" ? data.session_token : "" }
      },
      START_REQUEST_TIMEOUT,
    ),

  getStatus: (url, sessionType) => {
    const statusUrl = new URL(url)
    statusUrl.searchParams.set("session_type", sessionType)
    return request(fetch, statusUrl, { method: "GET" }, async (response) => {
      const data = await response.json()
      if (data.status === "CREATED" && data.ul !== undefined) return { status: "CREATED", ul: new URL(data.ul) }
      return data as StatusResponse
    })
  },

  cancelSession: (url) => request(fetch, url, { method: "DELETE" }, async () => undefined),
})
