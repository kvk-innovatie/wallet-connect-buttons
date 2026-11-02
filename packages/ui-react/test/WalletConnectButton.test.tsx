import { bw, nb, np, up18 } from "@wallet-connect/core"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
const Button = createWalletConnectButton({ brands: { default: np, business: bw, over18: up18 }, fetch, nbwalletWarning: "use nb-wallet-connect-button-react" })
const NbButton = createWalletConnectButton({ brands: { default: nb }, fetch })

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

  it("renders the NB brand with download badges and the install qr code", async () => {
    render(<NbButton serviceId="EH_1" apiKey="k" />)
    expect(screen.getByTestId("wallet_button").textContent).toBe("Inloggen met de ZZP Garantie app")
    fireEvent.click(screen.getByTestId("wallet_button"))
    await waitFor(() => expect(byTestId("qr")).not.toBeNull())
    expect(document.body.querySelector(".wcb-overlay")!.className).toContain("wcb-nbwallet")
    fireEvent.click(byTestId("download_director_badge")!)
    expect(byTestId("install_section")!.getAttribute("data-role")).toBe("director")
    fireEvent.click(byTestId("back_header_button")!)
    expect(byTestId("install_section")).toBeNull()
    expect(fetch.mock.calls.some(([url]) => url === "https://connect.nbwallet.org/api/service/EH_1/requested-credentials")).toBe(true)
  })

  it("shows static issuance links without a session", async () => {
    render(<Button clientId="c" issuance business />)
    fireEvent.click(screen.getByTestId("wallet_button"))
    await waitFor(() => expect(byTestId("qr")).not.toBeNull())
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rebuilds the controller when props change and keeps working", async () => {
    const { rerender } = render(<Button clientId="c" lang="en" />)
    expect(screen.getByRole("button").textContent).toBe("Login with NP Wallet")
    rerender(<Button clientId="c" lang="nl" business />)
    expect(screen.getByRole("button").textContent).toBe("Inloggen met Business Wallet")
  })
})
