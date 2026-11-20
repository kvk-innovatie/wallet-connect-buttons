import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi, REQUEST_TIMEOUT, START_REQUEST_TIMEOUT, START_TIMEOUT } from "../src/session/api"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

/** A fetch that never answers, and rejects like a real one when its request is aborted. */
const hangingFetch = () =>
  vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
  )

/** Whether `promise` has settled yet (without waiting for it). */
const settled = (promise: Promise<unknown>) => {
  let done = false
  promise.then(
    () => (done = true),
    () => (done = true),
  )
  return () => done
}

describe("fetchApi", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("creates a session and resolves the status url against the start url", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status_url: "/disclosure/abc/status", session_token: "abc" }))
    const api = fetchApi(fetch)
    const response = await api.createSession(new URL("https://rp.example/api/create-session"), { usecase: "u" })
    expect(response).toEqual({ status_url: new URL("https://rp.example/disclosure/abc/status"), session_token: "abc" })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe("https://rp.example/api/create-session")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ usecase: "u" })
  })

  it("posts any JSON body (a page backend's own) and keeps an absolute status url as is", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status_url: "https://wallet-connect.eu/api/issuance/sessions/t1", session_token: "t1" }))
    const response = await fetchApi(fetch).createSession(new URL("https://backend.example/api/test-pid/session"), { person: "N3" })
    expect(response.status_url.toString()).toBe("https://wallet-connect.eu/api/issuance/sessions/t1")
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ person: "N3" })
  })

  it("resolves a relative status url against a backend's start url", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status_url: "status/t1", session_token: "t1" }))
    const response = await fetchApi(fetch).createSession(new URL("https://backend.example/api/login/session"), {})
    expect(response.status_url.toString()).toBe("https://backend.example/api/login/status/t1")
  })

  it("fails when the answer has no usable status url", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    for (const body of [{ session_token: "t1" }, { status_url: "", session_token: "t1" }, { status_url: 42 }, "not json"]) {
      const fetch = vi.fn().mockResolvedValue(typeof body === "string" ? new Response(body) : json(body))
      await expect(fetchApi(fetch).createSession(new URL("https://backend.example/s"), {})).rejects.toBe("failed")
    }
  })

  it("asks for the status of one session type and parses the universal link", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status: "CREATED", ul: "walletdebuginteraction://x/-/" }))
    const status = await fetchApi(fetch).getStatus(new URL("https://rp.example/status"), "cross_device")
    expect(fetch.mock.calls[0][0]).toBe("https://rp.example/status?session_type=cross_device")
    expect(status).toEqual({ status: "CREATED", ul: new URL("walletdebuginteraction://x/-/") })
  })

  it("passes other statuses through", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ status: "EXPIRED" }))
    expect(await fetchApi(fetch).getStatus(new URL("https://rp.example/status"), "same_device")).toEqual({ status: "EXPIRED" })
  })

  it("cancels with DELETE", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await fetchApi(fetch).cancelSession(new URL("https://rp.example/status"))
    expect(fetch.mock.calls[0][1].method).toBe("DELETE")
  })

  it("maps an HTTP error to failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetch = vi.fn().mockResolvedValue(json({ error: "nope" }, 500))
    await expect(fetchApi(fetch).getStatus(new URL("https://rp.example/status"), "same_device")).rejects.toBe("failed")
  })

  it("maps a connection failure to network", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(fetchApi(fetch).getStatus(new URL("https://rp.example/status"), "same_device")).rejects.toBe("network")
  })

  it("times out as a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const fetch = hangingFetch()
    const pending = fetchApi(fetch).getStatus(new URL("https://rp.example/status"), "same_device")
    const assertion = expect(pending).rejects.toBe("network")
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT)
    await assertion
  })

  describe("timeouts", () => {
    it("lets the dialog wait 15 s for a session start (backends count on it), and keeps the request open well beyond", () => {
      expect(REQUEST_TIMEOUT).toBe(5000)
      expect(START_TIMEOUT).toBe(15000)
      expect(START_REQUEST_TIMEOUT).toBeGreaterThanOrEqual(2 * START_TIMEOUT)
    })

    it.each([
      ["a status request", (api: ReturnType<typeof fetchApi>) => api.getStatus(new URL("https://rp.example/status"), "cross_device")],
      ["a cancel", (api: ReturnType<typeof fetchApi>) => api.cancelSession(new URL("https://rp.example/status"))],
    ])("aborts %s after REQUEST_TIMEOUT (5 s)", async (_name, call) => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      const fetch = hangingFetch()
      const pending = call(fetchApi(fetch))
      const assertion = expect(pending).rejects.toBe("network")
      const done = settled(pending)
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT - 1)
      expect(done()).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await assertion
      expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true)
    })

    it("waits for a session start that takes longer than REQUEST_TIMEOUT", async () => {
      const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
        await new Promise((r) => setTimeout(r, 6000))
        return json({ status_url: "https://wallet-connect.eu/api/issuance/sessions/t1", session_token: "t1" })
      })
      const pending = fetchApi(fetch).createSession(new URL("https://backend.example/api/test-pid/session"), { person: "N3" })
      await vi.advanceTimersByTimeAsync(6000)
      await expect(pending).resolves.toEqual({ status_url: new URL("https://wallet-connect.eu/api/issuance/sessions/t1"), session_token: "t1" })
      expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(false)
    })

    it("keeps a session start open past START_TIMEOUT, so a late session can still be cancelled, and aborts it at START_REQUEST_TIMEOUT", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      const fetch = hangingFetch()
      const pending = fetchApi(fetch).createSession(new URL("https://backend.example/api/test-pid/session"), { person: "N3" })
      const assertion = expect(pending).rejects.toBe("network")
      const done = settled(pending)
      await vi.advanceTimersByTimeAsync(START_TIMEOUT + 1)
      expect(done()).toBe(false)
      await vi.advanceTimersByTimeAsync(START_REQUEST_TIMEOUT - START_TIMEOUT - 2)
      expect(done()).toBe(false)
      expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await assertion
      expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true)
    })
  })
})
