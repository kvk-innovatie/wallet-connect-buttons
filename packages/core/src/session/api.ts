import type { ErrorType } from "./state"
import type { SessionType, StatusResponse } from "./openid4vc"
import type { SessionOptions, SessionResponse } from "./relying_party"

// half of the currently configured expiration time of the ephemeral session ID included in the session URL
export const REQUEST_TIMEOUT = 5000

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/** The three calls a session makes to the wallet-connect server. Injectable, so tests need no network. */
export interface SessionApi {
  createSession(url: URL, options: SessionOptions): Promise<SessionResponse>
  getStatus(url: URL, sessionType: SessionType): Promise<StatusResponse>
  cancelSession(url: URL): Promise<void>
}

const FAILED: ErrorType = "failed"
const NETWORK: ErrorType = "network"

export const defaultFetch: Fetch = (input, init) => globalThis.fetch(input, init)

/**
 * One request with the session timeout. Rejects with an `ErrorType`: "network" when the
 * request timed out or never reached a server, "failed" for every other problem.
 */
const request = async <T>(
  fetch: Fetch,
  url: URL,
  init: RequestInit,
  parse: (response: Response) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
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

export const fetchApi = (fetch: Fetch = defaultFetch): SessionApi => ({
  createSession: (url, options) =>
    request(
      fetch,
      url,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options) },
      async (response) => {
        const data = await response.json()
        // the server sends strings; a relative status_url is resolved against the start url
        return { status_url: new URL(data.status_url, url), session_token: data.session_token }
      },
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
