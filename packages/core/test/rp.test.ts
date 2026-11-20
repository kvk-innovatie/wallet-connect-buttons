// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest"
import { bw, np, up18, type Brand } from "../src/brands"
import { WalletConnectController, sessionBodyKey, type WalletConnectOptions } from "../src/rp/controller"
import { StaticSession, WalletSession } from "../src/session/WalletSession"
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

describe("sessionBodyKey", () => {
  it("changes only when the body's JSON does", () => {
    expect(sessionBodyKey({ person: "N3" })).toBe(sessionBodyKey({ person: "N3" }))
    expect(sessionBodyKey({ person: "N3" })).not.toBe(sessionBodyKey({ person: "N4" }))
    expect(sessionBodyKey(undefined)).toBeUndefined()
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(sessionBodyKey(circular)).toBe(circular)
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

  /** Mount for the current test only, also when it fails. */
  const mounted = (c: WalletConnectController) => {
    c.mount()
    onTestFinished(() => c.unmount())
    return c
  }

  it("derives label, host, help url and id names from the brand and options", () => {
    const c = new WalletConnectController({ brand: bw, clientId: "nlw_1", lang: "en", apiKey: "k" })
    expect(c.label).toBe("Login with Business Wallet")
    expect(c.host).toBe("https://bw.wallet-connect.eu")
    expect(c.helpBaseUrl.toString()).toBe("https://ebwallet.org/download")
    expect(c.startUrl.toString()).toBe("https://bw.wallet-connect.eu/api/create-session?lang=en&return_url=" + encodeURIComponent(window.location.href))
    expect(c.showRoleBadges).toBe(false)
    expect(new WalletConnectController({ brand: np, clientId: "c", label: "Go" }).label).toBe("Go")
    expect(new WalletConnectController({ brand: np, clientId: "c" }).startUrl.pathname).toBe("/api/create-session")
  })

  it("creates a session for an issuance; static links only for a brand on the static flow", () => {
    for (const brand of [np, bw, up18]) {
      expect(new WalletConnectController({ brand, clientId: "c", issuance: true }).staticLinks).toBeUndefined()
      expect(new WalletConnectController({ brand, clientId: "c", issuance: true }).createSession(vi.fn())).toBeInstanceOf(WalletSession)
    }
    expect(new WalletConnectController({ brand: np, clientId: "c" }).staticLinks).toBeUndefined()
    const staticNp: Brand = { ...np, issuanceFlow: "static" }
    const legacy = new WalletConnectController({ brand: staticNp, clientId: "c", issuance: true })
    expect(legacy.host).toBe("https://issuance.wallet-connect.eu")
    expect(legacy.staticLinks?.sameDeviceUl.protocol).toBe("walletdebuginteraction:")
    expect(legacy.createSession(vi.fn())).toBeInstanceOf(StaticSession)
    // a session started by the page's own backend is followed, whatever the brand
    expect(new WalletConnectController({ brand: staticNp, clientId: "c", issuance: true, sessionUrl: "/s" }).staticLinks).toBeUndefined()
  })

  it("starts an issuance at the lane's issuance sessions on the brand's own wallet-connect host", () => {
    const startUrl = (options: Partial<WalletConnectOptions>) =>
      new WalletConnectController({ brand: np, clientId: "c", issuance: true, ...options }).startUrl.toString()
    expect(startUrl({})).toBe("https://wallet-connect.eu/api/issuance/sessions?lang=nl")
    expect(startUrl({ brand: bw, lang: "en" })).toBe("https://bw.wallet-connect.eu/api/issuance/sessions?lang=en")
    // an API key changes nothing: the lane's issuance API needs none, so there is no backend proxy for it
    expect(startUrl({ brand: bw, apiKey: "k" })).toBe("https://bw.wallet-connect.eu/api/issuance/sessions?lang=nl")
    expect(startUrl({ brand: up18 })).toBe("https://wallet-connect.eu/api/issuance/sessions?lang=nl")
    expect(startUrl({ useLocalWcServer: true })).toBe("http://localhost:5021/api/issuance/sessions?lang=nl")
    expect(startUrl({ brand: bw, useLocalWcServer: true })).toBe("http://bw.localhost:5021/api/issuance/sessions?lang=nl")
  })

  it("starts any session at sessionUrl, resolved against the page", () => {
    expect(new WalletConnectController({ brand: np, clientId: "c", issuance: true, sessionUrl: "/api/test-pid/session" }).startUrl.toString()).toBe(
      `${window.location.origin}/api/test-pid/session`,
    )
    expect(new WalletConnectController({ brand: np, clientId: "c", apiKey: "k", sessionUrl: "https://backend.example/api/login/session" }).startUrl.toString()).toBe(
      "https://backend.example/api/login/session",
    )
  })

  describe("sessions", () => {
    const OFFER = "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fitb.issuance.wallet-connect.eu%2Foffer%2F1"
    const posts = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([, init]) => init?.method === "POST")
    const deletes = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([, init]) => init?.method === "DELETE")

    it("runs a lane issuance: { usecase } to wallet-connect, the offer on screen, no cancel when closed", async () => {
      const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") return json({ session_token: "t1", status_url: "https://bw.wallet-connect.eu/api/issuance/sessions/t1" })
        if (init?.method === "DELETE") return new Response(null, { status: 204 })
        return json({ status: "CREATED", ul: OFFER })
      })
      const onDone = vi.fn()
      const c = new WalletConnectController({ brand: bw, clientId: "nlw_eucc", issuance: true, lang: "en", fetch })
      const s = c.createSession(onDone)
      await s.start()
      expect(posts(fetch)).toEqual([["https://bw.wallet-connect.eu/api/issuance/sessions?lang=en", expect.objectContaining({ body: JSON.stringify({ usecase: "nlw_eucc" }) })]])
      expect(fetch.mock.calls[1][0]).toBe("https://bw.wallet-connect.eu/api/issuance/sessions/t1?session_type=cross_device")
      expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: new URL(OFFER) })
      await s.stop()
      expect(deletes(fetch)).toEqual([])
      expect(onDone).toHaveBeenCalledWith({ kind: "close" })
      expect(window.location.search).toBe("")
      s.dispose()
    })

    it("starts an issuance through the page's backend with sessionBody and follows the status_url it answers", async () => {
      const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "https://backend.example/api/kvk/eucc/E3/session") return json({ session_token: "t2", status_url: "https://bw.wallet-connect.eu/api/issuance/sessions/t2" })
        if (url.startsWith("https://bw.wallet-connect.eu/api/issuance/sessions/t2") && init?.method === "GET") return json({ status: "CREATED", ul: OFFER })
        return json({}, 404)
      })
      const c = new WalletConnectController({
        brand: bw,
        clientId: "nlw_eucc",
        issuance: true,
        sessionUrl: "https://backend.example/api/kvk/eucc/E3/session",
        sessionBody: { person: "N3" },
        fetch,
      })
      const s = c.createSession(vi.fn())
      await s.start()
      expect(posts(fetch)).toHaveLength(1)
      expect(JSON.parse(posts(fetch)[0][1]!.body as string)).toEqual({ person: "N3" })
      expect(fetch.mock.calls[1][0]).toBe("https://bw.wallet-connect.eu/api/issuance/sessions/t2?session_type=cross_device")
      expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: new URL(OFFER) })
      s.dispose()
    })

    it("starts a disclosure through the page's backend ({} by default, relative status_url) and fetches the attributes when done", async () => {
      const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "https://backend.example/api/login/session") return json({ session_token: "t3", status_url: "status/t3" })
        if (url.startsWith("https://backend.example/api/login/status/t3")) return json({ status: "DONE" })
        if (url.includes("/api/disclosed-attributes")) return json({ attributes: { pid: {} } })
        return json({}, 404)
      })
      const onSuccess = vi.fn()
      const c = mounted(new WalletConnectController({ brand: np, clientId: "nlw_login", apiKey: "k", sessionUrl: "https://backend.example/api/login/session", onSuccess, fetch }))
      const onDone = vi.fn()
      const s = c.createSession(onDone)
      await s.start()
      expect(JSON.parse(posts(fetch)[0][1]!.body as string)).toEqual({})
      expect(s.getState()).toMatchObject({ kind: "success", session: { sessionToken: "t3", sessionType: "cross_device" } })
      s.close()
      await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { pid: {} } }))
      expect(fetch.mock.calls.at(-1)![0]).toBe("https://wallet-connect.eu/api/disclosed-attributes?session_token=t3&client_id=nlw_login")
      expect(onDone).toHaveBeenCalledWith({ kind: "success", sessionToken: "t3", sessionType: "cross_device" })
    })

    it("does not fetch attributes for an issuance that reports DONE", async () => {
      const fetch = vi.fn(async () => json({}, 404))
      const onSuccess = vi.fn()
      const onDone = vi.fn()
      const c = mounted(new WalletConnectController({ brand: np, clientId: "c", apiKey: "k", issuance: true, onSuccess, fetch }))
      const s = c.createSession(onDone)
      ;(s as unknown as { options: { onDone: (o: unknown) => void } }).options.onDone({ kind: "success", sessionToken: "tok", sessionType: "cross_device" })
      expect(onDone).toHaveBeenCalled()
      await new Promise((r) => setTimeout(r, 0))
      expect(fetch).not.toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
      expect(window.location.search).toBe("")
    })
  })

  it("leaves a disclosure's session token in the url to the disclosure button: an issuance button ignores it", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok&nonce=n")
    const fetch = vi.fn().mockResolvedValue(json({ attributes: { a: 1 } }))
    const issuer = mounted(new WalletConnectController({ brand: np, clientId: "issuer", apiKey: "k", issuance: true, fetch }))
    window.dispatchEvent(new Event("popstate"))
    window.dispatchEvent(new MessageEvent("message", { data: { type: SESSION_MESSAGE_TYPE, session_token: "tok" }, origin: window.location.origin }))
    await new Promise((r) => setTimeout(r, 0))
    expect(fetch).not.toHaveBeenCalled()
    expect(issuer.getState().phase.kind).toBe("idle")
    expect(window.location.search).toBe("?session_token=tok&nonce=n")

    // the disclosure button on the same page still picks it up
    const onSuccess = vi.fn()
    mounted(new WalletConnectController({ brand: np, clientId: "verifier", apiKey: "k", onSuccess, fetch }))
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { a: 1 } }))
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["https://wallet-connect.eu/api/disclosed-attributes?session_token=tok&client_id=verifier&nonce=n"])
    expect(window.location.search).toBe("")
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
    const c = new WalletConnectController({ brand: bw, clientId: "s", apiKey: "k", fetch })
    expect(await c.loadRequestedCredentials()).toEqual(credentials)
    expect(c.getState().credentials).toEqual(credentials)
    expect(fetch.mock.calls[0][0]).toBe("https://bw.wallet-connect.eu/api/client/s/requested-credentials")
  })
})
