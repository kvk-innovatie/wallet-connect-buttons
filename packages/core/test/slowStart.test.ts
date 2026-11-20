// A page backend (`sessionUrl`) that needs several seconds to start a session, end to end through fetchApi and
// WalletSession. Adapted from the review probe that found every start aborted after REQUEST_TIMEOUT (5 s): the
// dialog showed the network error while the backend still created the session, and nothing cancelled it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi, REQUEST_TIMEOUT, START_REQUEST_TIMEOUT, START_TIMEOUT, type Fetch } from "../src/session/api"
import { WalletSession } from "../src/session/WalletSession"

const START_URL = "https://backend.example/api/test-pid/session"
const STATUS_URL = "https://wallet-connect.eu/api/issuance/sessions/t"
const OFFER = "openid-credential-offer://?credential_offer_uri=x"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

/**
 * A backend that answers the session start after `startMs` (null: never) and honours aborts like a real fetch.
 * Its session exists from `startMs` on, whatever the browser does. Status requests answer the offer at once, or
 * never (`statusHangs`).
 */
const backend = (startMs: number | null, { statusHangs = false } = {}) => {
  const calls: string[] = []
  let created = false
  const reply = (init: RequestInit | undefined, ms: number | null, body: () => Response) =>
    new Promise<Response>((resolve, reject) => {
      const timer = ms === null ? undefined : setTimeout(() => resolve(body()), ms)
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer)
        reject(new DOMException("aborted", "AbortError"))
      })
    })
  const fetch = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? "GET"
    calls.push(`${method} ${input}`)
    if (method === "POST") {
      // the backend keeps working whatever the browser does (a lock wait and a few wallet-connect calls)
      if (startMs !== null) setTimeout(() => (created = true), startMs)
      return reply(init, startMs, () => json({ session_token: "t", status_url: STATUS_URL }))
    }
    if (method === "DELETE") return new Response(null, { status: 204 })
    if (statusHangs) return reply(init, null, () => json({}))
    return json({ status: "CREATED", ul: OFFER })
  })
  return { fetch, calls, created: () => created }
}

const issuance = (fetch: Fetch) =>
  new WalletSession({
    startUrl: new URL(START_URL),
    usecase: "nlw_x",
    startBody: { person: "N3" },
    issuance: true,
    isMobile: false,
    api: fetchApi(fetch),
  })

describe("a slow sessionUrl backend, end to end", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("shows the offer of a backend that needs 6 s (the review's probe, which got the network error at 5 s)", async () => {
    const b = backend(6000)
    const s = issuance(b.fetch)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT + 1)
    expect(s.getState().kind).toBe("creating")
    await vi.advanceTimersByTimeAsync(6000 - REQUEST_TIMEOUT - 1)
    await started
    expect(b.created()).toBe(true)
    expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: new URL(OFFER) })
    expect(b.calls).toEqual([`POST ${START_URL}`, `GET ${STATUS_URL}?session_type=cross_device`])
    s.dispose()
  })

  it("shows the network error at 15 s for a backend that needs 16 s, and cancels the session it still creates (one DELETE)", async () => {
    const b = backend(16000)
    const s = issuance(b.fetch)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT)
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
    expect(b.calls).toEqual([`POST ${START_URL}`])
    await vi.advanceTimersByTimeAsync(1000)
    await started
    expect(b.created()).toBe(true)
    expect(b.calls).toEqual([`POST ${START_URL}`, `DELETE ${STATUS_URL}`])
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
    s.dispose()
  })

  it("aborts a start that never gets an answer only at START_REQUEST_TIMEOUT; there is no session to cancel", async () => {
    const b = backend(null)
    const s = issuance(b.fetch)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT)
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
    const signal = b.fetch.mock.calls[0][1]!.signal!
    await vi.advanceTimersByTimeAsync(START_REQUEST_TIMEOUT - START_TIMEOUT - 1)
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await started
    expect(signal.aborted).toBe(true)
    expect(b.calls).toEqual([`POST ${START_URL}`])
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
  })

  it("still gives a status request only REQUEST_TIMEOUT (5 s)", async () => {
    const b = backend(100, { statusHangs: true })
    const s = issuance(b.fetch)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(b.calls).toEqual([`POST ${START_URL}`, `GET ${STATUS_URL}?session_type=cross_device`])
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT - 1)
    expect(s.getState().kind).toBe("creating")
    await vi.advanceTimersByTimeAsync(1)
    await started
    expect(s.getState()).toMatchObject({ kind: "error", errorType: "network" })
    expect(b.fetch.mock.calls[1][1]!.signal!.aborted).toBe(true)
    expect(b.calls.filter((call) => call.startsWith("DELETE"))).toEqual([])
  })
})
