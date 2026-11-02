import { bw, np, up18 } from "@wallet-connect/core"
import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { createWalletConnectButton } from "../src"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const fakeServer = (status: () => unknown = () => ({ status: "CREATED", ul: "walletdebuginteraction://x/-/" })) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/create-session")) return json({ status_url: "https://wallet-connect.eu/disclosure/abc/status", session_token: "abc" })
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


  it("shows static issuance links without a session", async () => {
    const w = mount(Button, { props: { clientId: "c", issuance: true, business: true }, attachTo: document.body })
    await w.get("button").trigger("click")
    await flushPromises()
    expect(inBody("[data-testid=qr]")).not.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    w.unmount()
  })
})
