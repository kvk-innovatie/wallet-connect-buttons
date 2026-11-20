import { bw, np, up18 } from "@wallet-connect/core"
import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { createWalletConnectButton } from "../src"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const OFFER = "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fitb.issuance.wallet-connect.eu%2Foffer%2F1"

/** wallet-connect: disclosures (create-session), lane issuance sessions, and a page backend's /session routes. */
const fakeServer = (status: () => unknown = () => ({ status: "CREATED", ul: "walletdebuginteraction://x/-/" })) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/create-session")) return json({ status_url: "https://wallet-connect.eu/disclosure/abc/status", session_token: "abc" })
    if (url.includes("/api/issuance/sessions?")) return json({ status_url: `${new URL(url).origin}/api/issuance/sessions/abc/status`, session_token: "abc" })
    if (url.endsWith("/session") && init?.method === "POST") return json({ status_url: "https://wallet-connect.eu/api/issuance/sessions/def/status", session_token: "def" })
    if (url.includes("/status")) return init?.method === "DELETE" ? new Response(null, { status: 204 }) : json(status())
    if (url.includes("/disclosed-attributes")) return json({ attributes: { pid: {} } })
    if (url.includes("/requested-credentials")) return json({ data: { requestedCredentials: [{ credentialKey: "k", credentialName: { en: "Diploma", nl: "Diploma" }, websiteUrl: "https://w", vct: "v" }] } })
    return json({}, 404)
  })

const fetch = fakeServer()
const Button = createWalletConnectButton({ brands: { default: np, business: bw, over18: up18 }, fetch, nbwalletWarning: "use nb-wallet-connect-button-vue" })

const inBody = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const click = (el: Element | null) => el!.dispatchEvent(new MouseEvent("click", { bubbles: true }))

describe("WalletConnectButton (Vue)", () => {
  beforeEach(() => {
    fetch.mockClear()
    window.history.replaceState({}, "", "/page")
  })
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("renders the brand's text or the label, and passes class through to the button", () => {
    const w = mount(Button, { props: { clientId: "c", lang: "en" }, attrs: { class: "mine" } })
    expect(w.get("button.wcb-button").text()).toBe("Login with NP Wallet")
    expect(w.get("button").classes()).toContain("mine")
    expect(mount(Button, { props: { clientId: "c", business: true } }).get(".wcb-button__label").text()).toBe("Inloggen met Business Wallet")
    expect(mount(Button, { props: { serviceId: "c", over18: true, lang: "en" } }).get(".wcb-button__label").text()).toBe("Login with 18up")
    expect(mount(Button, { props: { clientId: "c", label: "Go" } }).get(".wcb-button__label").text()).toBe("Go")
  })

  it("warns once about nbwallet on this package", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount(Button, { props: { clientId: "c", nbwallet: true } })
    mount(Button, { props: { clientId: "c", nbwallet: true } })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("opens the dialog in <body>, shows the qr code and the requested credentials, and closes", async () => {
    const w = mount(Button, { props: { clientId: "c", apiKey: "k", lang: "en" }, attachTo: document.body })
    await w.get("button").trigger("click")
    expect(inBody("[data-testid=wallet_modal]")).not.toBeNull()
    expect(inBody("[data-testid=loading]")).not.toBeNull()
    await vi.waitFor(() => expect(inBody("[data-testid=qr]")).not.toBeNull())
    expect(inBody(".wcb-modal")!.className).toContain("wcb-created")
    expect(inBody("[role=dialog]")!.getAttribute("aria-label")).toBe("NP Wallet")
    await vi.waitFor(() => expect(inBody("[data-testid=required_credentials]")!.textContent).toContain("Diploma"))
    expect(w.get("button").attributes("aria-hidden")).toBe("true")

    click(inBody("[data-testid=close_button]"))
    await vi.waitFor(() => expect(inBody("[data-testid=wallet_modal]")).toBeNull())
    expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true)
    expect(w.get("button").attributes("aria-hidden")).toBeUndefined()
    w.unmount()
  })

  it("calls onSuccess with the disclosed attributes for a session token in the url", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok")
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    const slow = vi.fn(async (url: string, init?: RequestInit) => {
      await held
      return fetch(url, init)
    })
    const Held = createWalletConnectButton({ brands: { default: np }, fetch: slow })
    const onSuccess = vi.fn()
    const w = mount(Held, { props: { clientId: "c", apiKey: "k", onSuccess } })
    await nextTick()
    expect(w.find("[data-testid=checking_attributes]").exists()).toBe(true)
    release()
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { pid: {} } }))
    await flushPromises()
    expect(w.find("button").exists()).toBe(true)
    expect(window.location.search).toBe("")
  })

  it("shows the error card when the attributes cannot be fetched", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    window.history.replaceState({}, "", "/page?session_token=tok")
    const failing = vi.fn().mockResolvedValue(json({}, 403))
    const Failing = createWalletConnectButton({ brands: { default: np }, fetch: failing })
    const w = mount(Failing, { props: { clientId: "c", apiKey: "k" } })
    await vi.waitFor(() => expect(w.find("[data-testid=attributes_error]").exists()).toBe(true))
    expect(w.text()).toContain("HTTP error! status: 403")
  })

  it("calls onFailed with the outcome when an error is closed", async () => {
    const Failing = createWalletConnectButton({ brands: { default: np }, fetch: fakeServer(() => ({ status: "FAILED" })) })
    const onFailed = vi.fn()
    const w = mount(Failing, { props: { clientId: "c", apiKey: "k", onFailed }, attachTo: document.body })
    await w.get("button").trigger("click")
    await vi.waitFor(() => expect(inBody("[data-testid=failed_header]")).not.toBeNull())
    click(inBody("[data-testid=close_button]"))
    expect(onFailed).toHaveBeenCalledWith({ kind: "failed", sessionToken: "abc", sessionType: "cross_device" })
    w.unmount()
  })


  it("creates an issuance session at wallet-connect and leaves it alone when closed after the offer", async () => {
    const lane = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
    const Issuer = createWalletConnectButton({ brands: { default: np, business: bw }, fetch: lane })
    const w = mount(Issuer, { props: { clientId: "nlw_eucc", issuance: true, business: true }, attachTo: document.body })
    await w.get("button").trigger("click")
    await vi.waitFor(() => expect(inBody("[data-testid=qr]")).not.toBeNull())
    const [url, init] = lane.mock.calls[0]
    expect(url).toBe("https://bw.wallet-connect.eu/api/issuance/sessions?lang=nl")
    expect(JSON.parse(init!.body as string)).toEqual({ usecase: "nlw_eucc" })
    click(inBody("[data-testid=close_button]"))
    await vi.waitFor(() => expect(inBody("[data-testid=wallet_modal]")).toBeNull())
    expect(lane.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false)
    w.unmount()
  })

  it("starts the session at sessionUrl with sessionBody, and keeps it when the parent passes an equal body", async () => {
    const backend = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
    const Issuer = createWalletConnectButton({ brands: { default: np }, fetch: backend })
    const sessionUrl = "https://backend.example/api/test-pid/session"
    const w = mount(Issuer, { props: { clientId: "nlw_test_pid", issuance: true, sessionUrl, sessionBody: { person: "N3" } }, attachTo: document.body })
    await w.get("button").trigger("click")
    await vi.waitFor(() => expect(inBody("[data-testid=qr]")).not.toBeNull())
    const posts = () => backend.mock.calls.filter(([, init]) => init?.method === "POST")
    expect(posts().map(([url, init]) => [url, JSON.parse(init!.body as string)])).toEqual([[sessionUrl, { person: "N3" }]])

    const before = (w.findComponent({ name: "WalletModal" }).props() as { controller: unknown }).controller
    await w.setProps({ sessionBody: { person: "N3" } }) // a new object with the same content
    await flushPromises()
    expect((w.findComponent({ name: "WalletModal" }).props() as { controller: unknown }).controller).toBe(before)
    expect(posts()).toHaveLength(1)
    w.unmount()
  })

  it("leaves a disclosure's session token in the url to the disclosure button", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok")
    const issuer = mount(Button, { props: { clientId: "issuer", apiKey: "k", issuance: true } })
    await flushPromises()
    expect(fetch).not.toHaveBeenCalled()
    expect(issuer.find("button").exists()).toBe(true)
    expect(window.location.search).toBe("?session_token=tok")
    const onSuccess = vi.fn()
    mount(Button, { props: { clientId: "verifier", apiKey: "k", onSuccess } })
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { pid: {} } }))
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["https://wallet-connect.eu/api/disclosed-attributes?session_token=tok&client_id=verifier"])
  })
})
