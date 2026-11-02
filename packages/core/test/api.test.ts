import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi, REQUEST_TIMEOUT } from "../src/session/api"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

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
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    )
    const pending = fetchApi(fetch).getStatus(new URL("https://rp.example/status"), "same_device")
    const assertion = expect(pending).rejects.toBe("network")
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT)
    await assertion
  })
})
