// Port of wallet_web's DynamicWalletModal.spec.ts: the same scenarios, asserted on the state machine
// instead of on rendered test ids.
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionApi } from "../src/session/api"
import type { ErrorType } from "../src/session/state"
import { StaticSession, WalletSession, type SessionOutcome } from "../src/session/WalletSession"

const STATUS_URL = new URL("http://localhost:3001/disclosure/mkwL0sHfP2cLJcRMuDzCHXEofujk9nnl/status")
const TOKEN = "mkwL0sHfP2cLJcRMuDzCHXEofujk9nnl"
const UL = new URL("example://app.example.com/-/")

const api = {
  createSession: vi.fn(),
  getStatus: vi.fn(),
  cancelSession: vi.fn(),
} satisfies SessionApi

const delayed = <T>(value: T, ms: number) => async () => {
  await new Promise((r) => setTimeout(r, ms))
  return value
}

const session = (opts: { isMobile?: boolean; pollIntervalInMs?: number; onDone?: (o: SessionOutcome) => void } = {}) =>
  new WalletSession({
    startUrl: new URL("http://localhost/sessions"),
    usecase: "test123",
    isMobile: opts.isMobile ?? false,
    pollIntervalInMs: opts.pollIntervalInMs,
    api,
    onDone: opts.onDone,
  })

describe("WalletSession", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllTimers()
    vi.clearAllMocks()
    api.createSession.mockResolvedValue({ status_url: STATUS_URL, session_token: TOKEN })
    api.getStatus.mockImplementation(async () => ({ status: "CREATED", ul: UL }))
    api.cancelSession.mockResolvedValue(undefined)
  })

  it("is creating until the first status arrives", async () => {
    const s = session()
    expect(s.getState().kind).toBe("creating")
    const started = s.start()
    expect(s.getState().kind).toBe("creating")
    await started
    expect(s.getState().kind).toBe("created")
  })

  it("notifies subscribers of every state", async () => {
    const s = session()
    const seen: string[] = []
    s.subscribe((state) => seen.push(state.kind))
    await s.start()
    expect(seen).toEqual(["creating", "created"])
  })

  it("shows loading after choosing another device on mobile, then the qr code", async () => {
    const s = session({ isMobile: true })
    await s.start()
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionType: "same_device" } })

    api.getStatus.mockImplementation(delayed({ status: "CREATED", ul: UL }, 10000))
    const choosing = s.choose("cross_device")
    expect(s.getState().kind).toBe("loading")
    await vi.advanceTimersToNextTimerAsync()
    await choosing
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionType: "cross_device" } })
  })

  it("keeps the same-device link for the mobile flow", async () => {
    const s = session({ isMobile: true })
    await s.start()
    const state = s.getState()
    expect(state.kind).toBe("created")
    if (state.kind === "created") expect(state.sameDeviceUl.toString()).toBe("example://app.example.com/-/")
  })

  it("refreshes the status on the poll interval", async () => {
    const s = session()
    await s.start()
    expect(api.getStatus).toHaveBeenCalledTimes(1)
    await vi.advanceTimersToNextTimerAsync()
    expect(api.getStatus).toHaveBeenCalledTimes(2)
    expect(s.getState().kind).toBe("created")
  })

  it("uses a custom poll interval", async () => {
    const s = session({ pollIntervalInMs: 5000 })
    await s.start()
    api.getStatus.mockClear()
    await vi.advanceTimersByTimeAsync(4999)
    expect(api.getStatus).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.getStatus).toHaveBeenCalledTimes(1)
  })

  it("goes in progress when the qr code is scanned", async () => {
    const s = session()
    await s.start()
    api.getStatus.mockResolvedValue({ status: "WAITING_FOR_RESPONSE" })
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState().kind).toBe("in-progress")
  })

  it("asks for confirmation when stopping in progress, and goes back", async () => {
    const s = session()
    await s.start()
    api.getStatus.mockResolvedValue({ status: "WAITING_FOR_RESPONSE" })
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState().kind).toBe("in-progress")

    s.confirmStop()
    expect(s.getState().kind).toBe("confirm-stop")

    await s.back()
    expect(s.getState().kind).toBe("in-progress")
  })

  it.each([
    ["same_device", true],
    ["cross_device", false],
  ] as const)("succeeds with session type %s", async (sessionType, isMobile) => {
    const s = session({ isMobile })
    api.getStatus.mockResolvedValue({ status: "DONE" })
    await s.start()
    expect(s.getState()).toMatchObject({ kind: "success", session: { sessionType } })
  })

  describe("errors from the status endpoint", () => {
    it.each<[string, () => Promise<unknown>, ErrorType]>([
      ["CREATED without a link", async () => ({ status: "CREATED" }), "failed"],
      ["EXPIRED", async () => ({ status: "EXPIRED" }), "expired"],
      ["CANCELLED", async () => ({ status: "CANCELLED" }), "cancelled"],
      ["FAILED", async () => ({ status: "FAILED" }), "failed"],
      ["a failed request", async () => Promise.reject("failed" as ErrorType), "failed"],
      ["a network problem", async () => Promise.reject("network" as ErrorType), "network"],
    ])("maps %s", async (_name, status, errorType) => {
      const s = session()
      await s.start()
      expect(s.getState().kind).toBe("created")
      api.getStatus.mockImplementationOnce(status)
      await vi.advanceTimersToNextTimerAsync()
      expect(s.getState()).toMatchObject({ kind: "error", errorType })
    })
  })

  it.each<[ErrorType]>([["failed"], ["network"]])("maps a %s session creation", async (errorType) => {
    api.createSession.mockRejectedValueOnce(errorType)
    const s = session()
    await s.start()
    expect(s.getState()).toEqual({ kind: "error", errorType })
  })

  it("shows the qr code again after retrying on desktop", async () => {
    const s = session()
    await s.start()
    api.getStatus.mockResolvedValueOnce({ status: "FAILED" })
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState().kind).toBe("error")

    await s.retry()
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionType: "cross_device" } })
  })

  it("shows the device choice again after retrying on mobile", async () => {
    const s = session({ isMobile: true })
    await s.start()
    api.getStatus.mockResolvedValueOnce({ status: "FAILED" })
    await s.choose("same_device")
    expect(s.getState().kind).toBe("error")

    await s.retry()
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionType: "same_device" } })
  })

  describe("close", () => {
    it("reports success with the token and session type", async () => {
      const onDone = vi.fn()
      const s = session({ onDone })
      api.getStatus.mockResolvedValue({ status: "DONE" })
      await s.start()
      s.close()
      expect(onDone).toHaveBeenCalledWith({ kind: "success", sessionToken: TOKEN, sessionType: "cross_device" })
    })

    it("reports failure with the token and session type", async () => {
      const onDone = vi.fn()
      const s = session({ onDone })
      await s.start()
      api.getStatus.mockResolvedValueOnce({ status: "FAILED" })
      await vi.advanceTimersToNextTimerAsync()
      s.close()
      expect(onDone).toHaveBeenCalledWith({ kind: "failed", sessionToken: TOKEN, sessionType: "cross_device" })
    })

    it("just closes while creating", async () => {
      api.createSession.mockImplementationOnce(delayed({ status_url: STATUS_URL, session_token: TOKEN }, 10000))
      const onDone = vi.fn()
      const s = session({ onDone })
      void s.start()
      expect(s.getState().kind).toBe("creating")
      s.close()
      expect(onDone).toHaveBeenCalledWith({ kind: "close" })
    })

    it("just closes while loading", async () => {
      const onDone = vi.fn()
      const s = session({ isMobile: true, onDone })
      await s.start()
      api.getStatus.mockImplementation(delayed({ status: "CREATED", ul: UL }, 10000))
      void s.choose("cross_device")
      expect(s.getState().kind).toBe("loading")
      s.close()
      expect(onDone).toHaveBeenCalledWith({ kind: "close" })
    })

    it("turns into a failure while in progress", async () => {
      const onDone = vi.fn()
      const s = session({ onDone })
      await s.start()
      api.getStatus.mockResolvedValue({ status: "WAITING_FOR_RESPONSE" })
      await vi.advanceTimersToNextTimerAsync()
      expect(s.getState().kind).toBe("in-progress")
      s.close()
      expect(onDone).not.toHaveBeenCalled()
      expect(s.getState()).toMatchObject({ kind: "error", errorType: "failed" })
    })
  })

  describe("stop", () => {
    it("cancels the session and closes from the created screen", async () => {
      const onDone = vi.fn()
      const s = session({ onDone })
      await s.start()
      const stopping = s.stop()
      expect(s.getState().kind).toBe("loading")
      await stopping
      expect(api.cancelSession).toHaveBeenCalledWith(STATUS_URL)
      expect(onDone).toHaveBeenCalledWith({ kind: "close" })
    })

    it("cancels the session and shows the cancelled screen after confirming", async () => {
      const s = session()
      await s.start()
      api.getStatus.mockResolvedValue({ status: "WAITING_FOR_RESPONSE" })
      await vi.advanceTimersToNextTimerAsync()
      s.confirmStop()
      api.getStatus.mockResolvedValue({ status: "CANCELLED" })
      await s.stop()
      expect(api.cancelSession).toHaveBeenCalled()
      expect(s.getState()).toMatchObject({ kind: "error", errorType: "cancelled" })
    })
  })

  it("stops polling when disposed", async () => {
    const s = session()
    await s.start()
    s.dispose()
    api.getStatus.mockClear()
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.getStatus).not.toHaveBeenCalled()
  })
})

describe("StaticSession", () => {
  const links = {
    sameDeviceUl: new URL("example://same"),
    crossDeviceUl: new URL("example://cross"),
  }

  it("starts created with the device's session type", () => {
    expect(new StaticSession({ ...links, isMobile: true }).getState()).toMatchObject({
      kind: "created",
      sameDeviceUl: links.sameDeviceUl,
      session: { sessionType: "same_device" },
    })
    expect(new StaticSession({ ...links, isMobile: false }).getState()).toMatchObject({
      session: { sessionType: "cross_device" },
    })
  })

  it("switches session type on choose and closes on stop", async () => {
    const onDone = vi.fn()
    const s = new StaticSession({ ...links, isMobile: true, onDone })
    const seen: string[] = []
    s.subscribe((state) => seen.push(state.kind === "created" ? state.session.sessionType : state.kind))
    await s.choose("cross_device")
    expect(seen).toEqual(["cross_device"])
    await s.stop()
    expect(onDone).toHaveBeenCalledWith({ kind: "close" })
  })
})
