import { bw, np, up18 } from "@wallet-connect/core"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createWalletConnectButton } from "../src"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const OFFER = "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fitb.issuance.wallet-connect.eu%2Foffer%2F1"
const ID_STEP = "openid4vp://?client_id=x509_hash%3Aabc&request_uri=https%3A%2F%2Fwallet-connect.eu%2Frequest%2F1"

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
const Button = createWalletConnectButton({ brands: { default: np, business: bw, over18: up18 }, fetch, nbwalletWarning: "use nb-wallet-connect-button-react" })

const modal = () => document.body.querySelector<HTMLElement>("[data-testid=wallet_modal]")
const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid=${id}]`)

describe("WalletConnectButton (React)", () => {
  beforeEach(() => {
    fetch.mockClear()
    window.history.replaceState({}, "", "/page")
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders the brand's text or the label, with className and classes on the button", () => {
    render(<Button clientId="c" lang="en" className="mine" classes={{ button: "b", label: "l" }} />)
    const button = screen.getByRole("button")
    expect(button.textContent).toBe("Login with NP Wallet")
    expect(button.className).toBe("wcb-button mine b")
    expect(button.querySelector("span")!.className).toBe("wcb-button__label l")
    cleanup()
    render(<Button clientId="c" business />)
    expect(screen.getByRole("button").textContent).toBe("Inloggen met Business Wallet")
    cleanup()
    render(<Button serviceId="c" over18 lang="en" label="Go" />)
    expect(screen.getByRole("button").textContent).toBe("Go")
  })

  it("warns once about nbwallet on this package", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Button clientId="c" nbwallet />)
    render(<Button clientId="c" nbwallet />)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("opens the dialog in <body>, shows the qr code and credentials, and closes", async () => {
    render(<Button clientId="c" apiKey="k" lang="en" />)
    fireEvent.click(screen.getByTestId("wallet_button"))
    expect(modal()).not.toBeNull()
    expect(byTestId("loading")).not.toBeNull()
    await waitFor(() => expect(byTestId("qr")).not.toBeNull())
    expect(modal()!.className).toContain("wcb-created")
    expect(modal()!.getAttribute("aria-label")).toBe("NP Wallet")
    await waitFor(() => expect(byTestId("required_credentials")!.textContent).toContain("Diploma"))
    expect(screen.getByTestId("wallet_button").getAttribute("aria-hidden")).toBe("true")

    fireEvent.click(byTestId("close_button")!)
    await waitFor(() => expect(modal()).toBeNull())
    expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true)
    expect(screen.getByTestId("wallet_button").getAttribute("aria-hidden")).toBeNull()
  })

  it("calls onSuccess with the disclosed attributes for a session token in the url", async () => {
    window.history.replaceState({}, "", "/page?session_token=tok")
    const onSuccess = vi.fn()
    render(<Button clientId="c" apiKey="k" onSuccess={onSuccess} />)
    expect(screen.getByTestId("checking_attributes")).toBeTruthy()
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { pid: {} } }))
    await waitFor(() => expect(screen.queryByTestId("wallet_button")).not.toBeNull())
    expect(window.location.search).toBe("")
  })

  it("shows the error card when the attributes cannot be fetched", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    window.history.replaceState({}, "", "/page?session_token=tok")
    const Failing = createWalletConnectButton({ brands: { default: np }, fetch: vi.fn().mockResolvedValue(json({}, 403)) })
    render(<Failing clientId="c" apiKey="k" />)
    await waitFor(() => expect(screen.getByTestId("attributes_error").textContent).toContain("HTTP error! status: 403"))
  })

  it("calls onFailed with the outcome when an error is closed", async () => {
    const Failing = createWalletConnectButton({ brands: { default: np }, fetch: fakeServer(() => ({ status: "FAILED" })) })
    const onFailed = vi.fn()
    render(<Failing clientId="c" apiKey="k" onFailed={onFailed} />)
    fireEvent.click(screen.getByTestId("wallet_button"))
    await waitFor(() => expect(byTestId("failed_header")).not.toBeNull())
    fireEvent.click(byTestId("close_button")!)
    expect(onFailed).toHaveBeenCalledWith({ kind: "failed", sessionToken: "abc", sessionType: "cross_device" })
  })


  describe("issuance on the WE BUILD lane", () => {
    const posts = (f: typeof fetch) => f.mock.calls.filter(([, init]) => init?.method === "POST")
    const deleted = (f: typeof fetch) => f.mock.calls.some(([, init]) => init?.method === "DELETE")

    it("creates an issuance session at wallet-connect and leaves it alone when closed after the offer", async () => {
      const lane = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
      const Issuer = createWalletConnectButton({ brands: { default: np, business: bw }, fetch: lane })
      render(<Issuer clientId="nlw_eucc" issuance business lang="en" />)
      fireEvent.click(screen.getByTestId("wallet_button"))
      await waitFor(() => expect(byTestId("qr")).not.toBeNull())
      expect(posts(lane).map(([url, init]) => [url, JSON.parse(init!.body as string)])).toEqual([
        ["https://bw.wallet-connect.eu/api/issuance/sessions?lang=en", { usecase: "nlw_eucc" }],
      ])
      expect(lane.mock.calls.some(([url]) => url.startsWith("https://bw.wallet-connect.eu/api/issuance/sessions/abc/status?session_type=cross_device"))).toBe(true)
      expect(lane.mock.calls.some(([url]) => url.includes("issuance.wallet-connect.eu/disclosure"))).toBe(false)

      fireEvent.click(byTestId("close_button")!)
      await waitFor(() => expect(modal()).toBeNull())
      expect(deleted(lane)).toBe(false)
    })

    it("cancels the session when closed during the ID step, before any offer", async () => {
      const lane = fakeServer(() => ({ status: "CREATED", ul: ID_STEP }))
      const Issuer = createWalletConnectButton({ brands: { default: np }, fetch: lane })
      render(<Issuer clientId="nlw_issuer" issuance />)
      fireEvent.click(screen.getByTestId("wallet_button"))
      await waitFor(() => expect(byTestId("qr")).not.toBeNull())
      expect(posts(lane)[0][0]).toBe("https://wallet-connect.eu/api/issuance/sessions?lang=nl")
      fireEvent.click(byTestId("close_button")!)
      await waitFor(() => expect(modal()).toBeNull())
      expect(deleted(lane)).toBe(true)
    })

    it("starts the session at sessionUrl with sessionBody, and keeps it when the page re-renders with an equal body", async () => {
      const backend = fakeServer(() => ({ status: "CREATED", ul: OFFER }))
      const Issuer = createWalletConnectButton({ brands: { default: np }, fetch: backend })
      const page = (person: string) => <Issuer clientId="nlw_test_pid" issuance sessionUrl="https://backend.example/api/test-pid/session" sessionBody={{ person }} />
      const { rerender } = render(page("N3"))
      fireEvent.click(screen.getByTestId("wallet_button"))
      await waitFor(() => expect(byTestId("qr")).not.toBeNull())
      expect(posts(backend).map(([url, init]) => [url, JSON.parse(init!.body as string)])).toEqual([
        ["https://backend.example/api/test-pid/session", { person: "N3" }],
      ])
      expect(backend.mock.calls.some(([url]) => url.startsWith("https://wallet-connect.eu/api/issuance/sessions/def/status?session_type=cross_device"))).toBe(true)

      rerender(page("N3")) // a new object with the same content
      await new Promise((r) => setTimeout(r, 0))
      expect(modal()).not.toBeNull()
      expect(posts(backend)).toHaveLength(1)
    })

    it("leaves a disclosure's session token in the url to the disclosure button", async () => {
      window.history.replaceState({}, "", "/page?session_token=tok")
      const onSuccess = vi.fn()
      render(
        <>
          <Button clientId="issuer" issuance />
          <Button clientId="verifier" apiKey="k" onSuccess={onSuccess} />
        </>,
      )
      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { pid: {} } }))
      expect(fetch.mock.calls.map(([url]) => url)).toEqual(["https://wallet-connect.eu/api/disclosed-attributes?session_token=tok&client_id=verifier"])
      expect(screen.getAllByTestId("wallet_button")).toHaveLength(2)
      expect(screen.queryByTestId("attributes_error")).toBeNull()
    })

    it("an issuance button alone leaves the token in the url and shows no card", async () => {
      window.history.replaceState({}, "", "/page?session_token=tok")
      render(<Button clientId="issuer" apiKey="k" issuance />)
      await new Promise((r) => setTimeout(r, 0))
      expect(fetch).not.toHaveBeenCalled()
      expect(screen.getByTestId("wallet_button")).toBeTruthy()
      expect(window.location.search).toBe("?session_token=tok")
    })
  })

  it("starts a disclosure at sessionUrl with {} and calls onSuccess once it is done", async () => {
    const done = fakeServer(() => ({ status: "DONE" }))
    const Verifier = createWalletConnectButton({ brands: { default: np }, fetch: done })
    const onSuccess = vi.fn()
    render(<Verifier clientId="nlw_login" apiKey="k" sessionUrl="/api/pid-login/session" onSuccess={onSuccess} />)
    fireEvent.click(screen.getByTestId("wallet_button"))
    await waitFor(() => expect(byTestId("success_cross_device")).not.toBeNull())
    const [url, init] = done.mock.calls[0]
    expect(url).toBe(`${window.location.origin}/api/pid-login/session`)
    expect(JSON.parse(init!.body as string)).toEqual({})
    fireEvent.click(byTestId("close_button")!)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ attributes: { pid: {} } }))
    expect(done.mock.calls.at(-1)![0]).toBe("https://wallet-connect.eu/api/disclosed-attributes?session_token=def&client_id=nlw_login")
  })

  it("rebuilds the controller when props change and keeps working", async () => {
    const { rerender } = render(<Button clientId="c" lang="en" />)
    expect(screen.getByRole("button").textContent).toBe("Login with NP Wallet")
    rerender(<Button clientId="c" lang="nl" business />)
    expect(screen.getByRole("button").textContent).toBe("Inloggen met Business Wallet")
  })
})
