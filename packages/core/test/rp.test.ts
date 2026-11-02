// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nb, np } from "../src/brands"
import { WalletConnectController } from "../src/rp/controller"
import { disclosedAttributesUrl, fetchDisclosedAttributes } from "../src/rp/disclosed"
import { SESSION_MESSAGE_TYPE, sessionFromMessage } from "../src/rp/iframe"
import { clearRequestedCredentialsCache, fetchRequestedCredentials } from "../src/rp/requested"
import { clearSessionParams, readSessionParams, writeSessionParams } from "../src/rp/urlParams"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("sessionFromMessage", () => {
  const returnUrl = "https://host.example/page"
  it("accepts a session message from the return url's origin", () => {
    expect(
      sessionFromMessage({ data: { type: SESSION_MESSAGE_TYPE, session_token: "t", nonce: "n" }, origin: "https://host.example" }, returnUrl),
    ).toEqual({ session_token: "t", nonce: "n" })
    expect(sessionFromMessage({ data: { type: SESSION_MESSAGE_TYPE, session_token: "t" }, origin: "https://host.example" }, returnUrl)).toEqual({
      session_token: "t",
      nonce: undefined,
    })
  })
  it("rejects other origins, other message types and empty tokens", () => {
    expect(sessionFromMessage({ data: { type: SESSION_MESSAGE_TYPE, session_token: "t" }, origin: "https://evil.example" }, returnUrl)).toBeNull()
    expect(sessionFromMessage({ data: { type: "other", session_token: "t" }, origin: "https://host.example" }, returnUrl)).toBeNull()
    expect(sessionFromMessage({ data: { type: SESSION_MESSAGE_TYPE, session_token: "" }, origin: "https://host.example" }, returnUrl)).toBeNull()
    expect(sessionFromMessage({ data: "string", origin: "https://host.example" }, returnUrl)).toBeNull()
    expect(sessionFromMessage({ data: { type: SESSION_MESSAGE_TYPE, session_token: "t" }, origin: "https://host.example" }, "")).toBeNull()
  })
})

describe("url params", () => {
  it("reads, writes and clears the session in the query string", () => {
    window.history.replaceState({}, "", "/page?keep=1")
    expect(readSessionParams(window.location.search)).toBeNull()
    writeSessionParams(window, { session_token: "tok", nonce: "n1" })
    expect(window.location.search).toBe("?keep=1&session_token=tok&nonce=n1")
    expect(readSessionParams(window.location.search)).toEqual({ session_token: "tok", nonce: "n1" })
    clearSessionParams(window)
    expect(window.location.search).toBe("?keep=1")
  })
})

describe("disclosed attributes", () => {
  it("calls the server directly with an api key, else the page's own backend", () => {
    expect(disclosedAttributesUrl({ host: "https://wallet-connect.eu", apiKey: "k", idParam: "client_id", clientId: "c", sessionToken: "t" })).toBe(
      "https://wallet-connect.eu/api/disclosed-attributes?session_token=t&client_id=c",
    )
    expect(disclosedAttributesUrl({ host: "https://connect.nbwallet.org", idParam: "service_id", clientId: "s", sessionToken: "t", nonce: "n" })).toBe(
      "/api/disclosed-attributes?session_token=t&service_id=s&nonce=n",
    )
  })
  it("sends the bearer token and surfaces the http status", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ attributes: {} }))
    await fetchDisclosedAttributes({ host: "h", apiKey: "k", idParam: "client_id", clientId: "c", sessionToken: "t" }, fetch)
    expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer k" })
    fetch.mockResolvedValue(json({}, 401))
    await expect(fetchDisclosedAttributes({ host: "h", apiKey: "k", idParam: "client_id", clientId: "c", sessionToken: "t" }, fetch)).rejects.toThrow(
      "HTTP error! status: 401",
    )
  })
})

describe("requested credentials", () => {
  beforeEach(() => clearRequestedCredentialsCache())
  it("fetches once per client and host, even concurrently", async () => {
    const credentials = [{ credentialKey: "k", credentialName: { en: "E", nl: "N" }, websiteUrl: "https://w", vct: "v" }]
    const fetch = vi.fn().mockResolvedValue(json({ data: { requestedCredentials: credentials } }))
    const r = { host: "https://connect.nbwallet.org", apiKey: "k", idPath: "service" as const, clientId: "s" }
    const [a, b] = await Promise.all([fetchRequestedCredentials(r, fetch), fetchRequestedCredentials(r, fetch)])
    expect(a).toEqual(credentials)
    expect(b).toEqual(credentials)
    expect(await fetchRequestedCredentials(r, fetch)).toEqual(credentials)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe("https://connect.nbwallet.org/api/service/s/requested-credentials")
  })
  it("does not cache failures", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({ data: { requestedCredentials: [] } }))
    const r = { host: "h", apiKey: "k", idPath: "client" as const, clientId: "c" }
    await expect(fetchRequestedCredentials(r, fetch)).rejects.toThrow()
    expect(await fetchRequestedCredentials(r, fetch)).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe("WalletConnectController", () => {
  beforeEach(() => window.history.replaceState({}, "", "/page"))
  afterEach(() => vi.restoreAllMocks())

  it("derives label, host, help url and id names from the brand and options", () => {
    const c = new WalletConnectController({ brand: nb, clientId: "EH_1", lang: "en", apiKey: "k" })
    expect(c.label).toBe("Login with the ZZP Garantie app")
    expect(c.host).toBe("https://connect.nbwallet.org")
    expect(c.helpBaseUrl.toString()).toBe("https://nbwallet.org/download")
    expect(c.startUrl.toString()).toBe("https://connect.nbwallet.org/api/create-session?lang=en&return_url=" + encodeURIComponent(window.location.href))
    expect(c.showRoleBadges).toBe(true)
    expect(new WalletConnectController({ brand: np, clientId: "c", label: "Go" }).label).toBe("Go")
    expect(new WalletConnectController({ brand: np, clientId: "c" }).startUrl.pathname).toBe("/api/create-session")
  })

  it("gives static links for an issuance and a dynamic session otherwise", () => {
    const issuance = new WalletConnectController({ brand: np, clientId: "c", issuance: true })
    expect(issuance.staticLinks?.sameDeviceUl.protocol).toBe("walletdebuginteraction:")
    expect(new WalletConnectController({ brand: np, clientId: "c" }).staticLinks).toBeUndefined()
  })

  it("fetches disclosed attributes for a session token in the url on mount, then clears it", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok&nonce=n")
    const fetch = vi.fn().mockResolvedValue(json({ attributes: { a: 1 } }))
    const onSuccess = vi.fn()
    const c = new WalletConnectController({ brand: np, clientId: "c", apiKey: "k", onSuccess, fetch })
    const phases: string[] = []
    c.subscribe((s) => phases.push(s.phase.kind))
    c.mount()
    expect(c.getState().phase.kind).toBe("checking")
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { a: 1 } }))
    expect(fetch.mock.calls[0][0]).toBe("https://wallet-connect.eu/api/disclosed-attributes?session_token=tok&client_id=c&nonce=n")
    expect(phases).toEqual(["checking", "idle"])
    expect(window.location.search).toBe("")
    c.unmount()
  })

  it("shows an error when the attributes cannot be fetched", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    window.history.replaceState({}, "", "/page?session_token=tok")
    const fetch = vi.fn().mockResolvedValue(json({}, 403))
    const c = new WalletConnectController({ brand: np, clientId: "c", apiKey: "k", fetch })
    c.mount()
    await vi.waitFor(() => expect(c.getState().phase).toEqual({ kind: "error", message: "HTTP error! status: 403" }))
    expect(window.location.search).toBe("")
    c.unmount()
  })

  it("accepts a session posted by the host page from the return url's origin", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ ok: true }))
    const onSuccess = vi.fn()
    const c = new WalletConnectController({ brand: np, clientId: "c", apiKey: "k", returnUrl: "https://host.example/outer", onSuccess, fetch })
    c.mount()
    window.dispatchEvent(new MessageEvent("message", { data: { type: SESSION_MESSAGE_TYPE, session_token: "tok" }, origin: "https://evil.example" }))
    expect(fetch).not.toHaveBeenCalled()
    window.dispatchEvent(new MessageEvent("message", { data: { type: SESSION_MESSAGE_TYPE, session_token: "tok" }, origin: "https://host.example" }))
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true }))
    c.unmount()
  })

  it("puts a cross-device success in the url and fetches the attributes", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ done: true }))
    const onSuccess = vi.fn()
    const onDone = vi.fn()
    const c = new WalletConnectController({ brand: np, clientId: "c", apiKey: "k", onSuccess, fetch })
    c.mount()
    const session = c.createSession(onDone)
    expect(session.getState().kind).toBe("creating")
    // simulate the dialog finishing: the controller wraps onDone
    ;(session as unknown as { options: { onDone: (o: unknown) => void } }).options.onDone({
      kind: "success",
      sessionToken: "tok",
      sessionType: "cross_device",
    })
    expect(onDone).toHaveBeenCalled()
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ done: true }))
    expect(fetch.mock.calls[0][0]).toContain("session_token=tok")
    c.unmount()
  })

  it("loads requested credentials only with an api key", async () => {
    clearRequestedCredentialsCache()
    const credentials = [{ credentialKey: "k", credentialName: { en: "E", nl: "N" }, websiteUrl: "", vct: "v" }]
    const fetch = vi.fn().mockResolvedValue(json({ data: { requestedCredentials: credentials } }))
    expect(await new WalletConnectController({ brand: np, clientId: "c", fetch }).loadRequestedCredentials()).toEqual([])
    const c = new WalletConnectController({ brand: nb, clientId: "s", apiKey: "k", fetch })
    expect(await c.loadRequestedCredentials()).toEqual(credentials)
    expect(c.getState().credentials).toEqual(credentials)
    expect(fetch.mock.calls[0][0]).toBe("https://connect.nbwallet.org/api/service/s/requested-credentials")
  })
})
