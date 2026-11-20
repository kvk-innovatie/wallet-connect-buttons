import { bw, np, up18 } from "@wallet-connect/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defineWalletConnectButton } from "../src/element"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const OFFER = "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fitb.issuance.wallet-connect.eu%2Foffer%2F1"

/**
 * A wallet-connect server that creates a session (disclosure, or issuance on the lane) and reports whatever
 * `status` says; also a page backend's /session route.
 */
const fakeServer = (status: () => unknown = () => ({ status: "CREATED", ul: "walletdebuginteraction://x/-/" })) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/api/create-session")) return json({ status_url: "https://wallet-connect.eu/disclosure/abc/status", session_token: "abc" })
    if (url.includes("/api/issuance/sessions?")) return json({ status_url: `${new URL(url).origin}/api/issuance/sessions/abc/status`, session_token: "abc" })
    if (url.endsWith("/session") && init?.method === "POST") return json({ status_url: "https://wallet-connect.eu/api/issuance/sessions/def/status", session_token: "def" })
    if (url.includes("/status")) return init?.method === "DELETE" ? new Response(null, { status: 204 }) : json(status())
    if (url.includes("/disclosed-attributes")) return json({ attributes: { pid: {} } })
    if (url.includes("/requested-credentials")) return json({ data: { requestedCredentials: [] } })
    return json({}, 404)
  })

const brands = { default: np, business: bw, over18: up18 }
const fetch = fakeServer()
defineWalletConnectButton("wallet-connect-button", brands, { fetch, nbwalletWarning: "use nb-wallet-connect-button" })

const mount = (html: string) => {
  document.body.innerHTML = html
  return document.body.firstElementChild as HTMLElement & { walletConnect: unknown }
}
const inShadow = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)
const click = (el: Element | null) => el!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
const flush = () => new Promise((r) => setTimeout(r, 0))

describe("<wallet-connect-button>", () => {
  beforeEach(() => {
    fetch.mockClear()
    window.history.replaceState({}, "", "/page")
  })
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("renders the brand's button text, or the label attribute", () => {
    const np = mount(`<wallet-connect-button client-id="c" lang="en"></wallet-connect-button>`)
    expect(inShadow(np, "[part=button] [part=button-span]")!.textContent).toBe("Login with NP Wallet")
    const bw = mount(`<wallet-connect-button client-id="c" business></wallet-connect-button>`)
    expect(inShadow(bw, ".wcb-button__label")!.textContent).toBe("Inloggen met Business Wallet")
    const labelled = mount(`<wallet-connect-button service-id="c" label="Go"></wallet-connect-button>`)
    expect(inShadow(labelled, ".wcb-button__label")!.textContent).toBe("Go")
    const up = mount(`<wallet-connect-button client-id="c" over18 lang="en"></wallet-connect-button>`)
    expect(inShadow(up, ".wcb-button__label")!.textContent).toBe("Login with 18up")
  })

  it("re-renders when an attribute changes", () => {
    const el = mount(`<wallet-connect-button client-id="c"></wallet-connect-button>`)
    el.setAttribute("label", "Later")
    expect(inShadow(el, ".wcb-button__label")!.textContent).toBe("Later")
    expect(el.shadowRoot!.querySelectorAll(".wcb-button").length).toBe(1)
  })

  it("warns once about nbwallet on a package without the NB brand and keeps the default brand", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount(`<wallet-connect-button client-id="c" nbwallet lang="en"></wallet-connect-button>`)
    mount(`<wallet-connect-button client-id="c" nbwallet lang="en"></wallet-connect-button>`)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("nb-wallet-connect-button")
  })

  it("opens the dialog with a qr code on desktop and closes it via the footer", async () => {
    const el = mount(`<wallet-connect-button client-id="c" api-key="k" lang="en"></wallet-connect-button>`)
    click(inShadow(el, "[part=button]"))
    expect(inShadow(el, "[data-testid=wallet_modal]")).not.toBeNull()
    expect(inShadow(el, "[data-testid=loading]")).not.toBeNull()
    await vi.waitFor(() => expect(inShadow(el, "[data-testid=qr]")).not.toBeNull())
    expect(inShadow(el, ".wcb-modal")!.className).toContain("wcb-created")
    expect(inShadow(el, "[data-testid=website_link] a")!.getAttribute("href")).toBe("https://npwallet.org/")
    expect(inShadow(el, ".wcb-overlay")!.getAttribute("aria-label")).toBeNull()
    expect(inShadow(el, "[role=dialog]")!.getAttribute("aria-label")).toBe("NP Wallet")
    expect(fetch.mock.calls.some(([url]) => url === "https://wallet-connect.eu/api/create-session?lang=en&return_url=" + encodeURIComponent(location.href))).toBe(true)

    click(inShadow(el, "[data-testid=close_button]"))
    await vi.waitFor(() => expect(inShadow(el, "[data-testid=wallet_modal]")).toBeNull())
    expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true)
    expect(inShadow(el, "[part=button]")!.getAttribute("aria-hidden")).toBeNull()
  })

  it("uses the page's own backend without an api key", async () => {
    const el = mount(`<wallet-connect-button client-id="c"></wallet-connect-button>`)
    click(inShadow(el, "[part=button]"))
    await flush()
    expect(fetch.mock.calls[0][0]).toBe(location.origin + "/api/create-session?lang=en&return_url=" + encodeURIComponent(location.href))
  })

  it("dispatches success with the disclosed attributes when the url carries a session token", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok")
    document.body.innerHTML = `<wallet-connect-button client-id="c" api-key="k"></wallet-connect-button>`
    const el = document.body.firstElementChild as HTMLElement
    const success = vi.fn()
    el.addEventListener("success", (e) => success((e as CustomEvent).detail))
    expect(inShadow(el, "[data-testid=checking_attributes]")).not.toBeNull()
    await vi.waitFor(() => expect(success).toHaveBeenCalledWith({ attributes: { pid: {} } }))
    expect(fetch.mock.calls[0][0]).toBe("https://wallet-connect.eu/api/disclosed-attributes?session_token=tok&client_id=c")
    expect(window.location.search).toBe("")
    expect(inShadow(el, "[data-testid=checking_attributes]")).toBeNull()
  })

  it("dispatches failed with the 1.x detail shape after an error is closed", async () => {
    const failing = fakeServer(() => ({ status: "FAILED" }))
    defineWalletConnectButton("wcb-failing", { default: np }, { fetch: failing })
    const el = mount(`<wcb-failing client-id="c" api-key="k"></wcb-failing>`)
    const failed = vi.fn()
    el.addEventListener("failed", (e) => failed((e as CustomEvent).detail))
    click(inShadow(el, "[part=button]"))
    await vi.waitFor(() => expect(inShadow(el, "[data-testid=failed_header]")).not.toBeNull())
    click(inShadow(el, "[data-testid=close_button]"))
    expect(failed).toHaveBeenCalledWith(["abc", "cross_device"])
  })

  it("does not throw when the tag is defined twice", () => {
    expect(() => defineWalletConnectButton("wallet-connect-button", brands)).not.toThrow()
  })


  it("creates an issuance session at wallet-connect and leaves it alone when closed after the offer", async () => {
    const lane = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
    defineWalletConnectButton("wcb-issuer", brands, { fetch: lane })
    const el = mount(`<wcb-issuer client-id="nlw_eucc" issuance business lang="en"></wcb-issuer>`)
    click(inShadow(el, "[part=button]"))
    await vi.waitFor(() => expect(inShadow(el, "[data-testid=qr]")).not.toBeNull())
    const [url, init] = lane.mock.calls[0]
    expect(url).toBe("https://bw.wallet-connect.eu/api/issuance/sessions?lang=en")
    expect(JSON.parse(init!.body as string)).toEqual({ usecase: "nlw_eucc" })
    click(inShadow(el, "[data-testid=close_button]"))
    await vi.waitFor(() => expect(inShadow(el, "[data-testid=wallet_modal]")).toBeNull())
    expect(lane.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false)
  })

  it("starts the session at session-url with the session-body JSON", async () => {
    const backend = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
    defineWalletConnectButton("wcb-backend", brands, { fetch: backend })
    const el = mount(`<wcb-backend client-id="nlw_test_pid" issuance session-url="/api/test-pid/session" session-body='{"person":"N3"}'></wcb-backend>`)
    click(inShadow(el, "[part=button]"))
    await vi.waitFor(() => expect(inShadow(el, "[data-testid=qr]")).not.toBeNull())
    const [url, init] = backend.mock.calls[0]
    expect(url).toBe(`${location.origin}/api/test-pid/session`)
    expect(JSON.parse(init!.body as string)).toEqual({ person: "N3" })
  })

  it("warns about a session-body that is not JSON and sends {}", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const backend = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
    defineWalletConnectButton("wcb-backend-bad", brands, { fetch: backend })
    const el = mount(`<wcb-backend-bad client-id="c" issuance session-url="/api/session" session-body="person=N3"></wcb-backend-bad>`)
    expect(warn).toHaveBeenCalledTimes(1)
    click(inShadow(el, "[part=button]"))
    await vi.waitFor(() => expect(backend).toHaveBeenCalled())
    expect(JSON.parse(backend.mock.calls[0][1]!.body as string)).toEqual({})
  })

  it("leaves a disclosure's session token in the url when it is an issuance button", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok")
    const el = mount(`<wallet-connect-button client-id="issuer" api-key="k" issuance></wallet-connect-button>`)
    await flush()
    expect(fetch).not.toHaveBeenCalled()
    expect(inShadow(el, "[data-testid=checking_attributes]")).toBeNull()
    expect(window.location.search).toBe("?session_token=tok")
  })
})
