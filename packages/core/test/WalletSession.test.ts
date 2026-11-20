// Port of wallet_web's DynamicWalletModal.spec.ts: the same scenarios, asserted on the state machine
// instead of on rendered test ids.
import { beforeEach, describe, expect, it, vi } from "vitest"
import { REQUEST_TIMEOUT, START_TIMEOUT, type SessionApi } from "../src/session/api"
import type { ErrorType } from "../src/session/state"
import {
  MAX_OFFER_POLL_FAILURES,
  StaticSession,
  WalletSession,
  isCredentialOffer,
  type SessionOutcome,
} from "../src/session/WalletSession"

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

  it("posts { usecase } by default, or the start body it was given", async () => {
    await session().start()
    expect(api.createSession).toHaveBeenLastCalledWith(new URL("http://localhost/sessions"), { usecase: "test123" })
    const s = new WalletSession({ startUrl: new URL("https://backend.example/session"), usecase: "test123", startBody: { person: "N3" }, isMobile: false, api })
    await s.start()
    expect(api.createSession).toHaveBeenLastCalledWith(new URL("https://backend.example/session"), { person: "N3" })
  })

  describe("answers nobody waits for any more", () => {
    it("cancels a session that is created after the dialog closed", async () => {
      api.createSession.mockImplementationOnce(delayed({ status_url: STATUS_URL, session_token: TOKEN }, 1000))
      const onDone = vi.fn()
      const s = session({ onDone })
      const started = s.start()
      s.close()
      expect(onDone).toHaveBeenCalledWith({ kind: "close" })
      await vi.advanceTimersByTimeAsync(1000)
      await started
      expect(api.cancelSession).toHaveBeenCalledWith(STATUS_URL)
      expect(api.getStatus).not.toHaveBeenCalled()
    })

    it("cancels the session of a start that a newer start replaced (React StrictMode runs effects twice)", async () => {
      const first = new URL("http://localhost:3001/disclosure/first/status")
      api.createSession
        .mockImplementationOnce(delayed({ status_url: first, session_token: "first" }, 1000))
        .mockImplementationOnce(delayed({ status_url: STATUS_URL, session_token: TOKEN }, 1000))
      const s = session()
      const a = s.start()
      const b = s.start()
      await vi.advanceTimersByTimeAsync(1000)
      await Promise.all([a, b])
      expect(api.cancelSession).toHaveBeenCalledTimes(1)
      expect(api.cancelSession).toHaveBeenCalledWith(first)
      expect(s.getState()).toMatchObject({ kind: "created", session: { sessionToken: TOKEN } })
      expect(api.getStatus.mock.calls.map(([url]) => url)).toEqual([STATUS_URL])
    })

    it("ignores a status that arrives after the user asked to stop", async () => {
      const s = session()
      await s.start()
      api.getStatus.mockResolvedValue({ status: "WAITING_FOR_RESPONSE" })
      await vi.advanceTimersToNextTimerAsync()
      api.getStatus.mockImplementation(delayed({ status: "WAITING_FOR_RESPONSE" }, 1000))
      vi.advanceTimersByTime(2000) // the next poll is now in flight
      s.confirmStop()
      await vi.advanceTimersByTimeAsync(1000)
      expect(s.getState().kind).toBe("confirm-stop")
    })
  })
})

describe("WalletSession: issuance on the WE BUILD lane", () => {
  const START_URL = new URL("https://wallet-connect.eu/api/issuance/sessions?lang=nl")
  const ID_STEP_1 = new URL("openid4vp://?client_id=x509_hash%3Aabc&request_uri=https%3A%2F%2Fwallet-connect.eu%2Frequest%2F1")
  const ID_STEP_2 = new URL("openid4vp://?client_id=x509_hash%3Aabc&request_uri=https%3A%2F%2Fwallet-connect.eu%2Frequest%2F2")
  const OFFER = new URL("openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fitb.issuance.wallet-connect.eu%2Foffer%2F1")

  const issuance = (opts: { isMobile?: boolean; onDone?: (o: SessionOutcome) => void } = {}) =>
    new WalletSession({ startUrl: START_URL, usecase: "nlw_issuer", isMobile: opts.isMobile ?? false, issuance: true, api, onDone: opts.onDone })

  /** The status endpoint answers these in turn, and the last one from then on. */
  const statuses = (...list: unknown[]) => {
    let i = 0
    api.getStatus.mockImplementation(async () => list[Math.min(i++, list.length - 1)])
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllTimers()
    // reset, not clear: a failing test must not leave queued answers (mockImplementationOnce) to the next
    vi.resetAllMocks()
    api.createSession.mockResolvedValue({ status_url: STATUS_URL, session_token: TOKEN })
    api.cancelSession.mockResolvedValue(undefined)
  })

  it("tells a credential offer from a presentation request", () => {
    expect(isCredentialOffer(OFFER)).toBe(true)
    expect(isCredentialOffer(new URL("haip-vci://?credential_offer_uri=x"))).toBe(true)
    expect(isCredentialOffer(ID_STEP_1)).toBe(false)
    expect(isCredentialOffer(UL)).toBe(false)
  })

  it("shows the offer of an issuer without an ID step at once, and keeps it until the session expires", async () => {
    statuses({ status: "CREATED", ul: OFFER }, { status: "CREATED", ul: OFFER }, { status: "EXPIRED" })
    const s = issuance()
    await s.start()
    expect(api.createSession).toHaveBeenCalledWith(START_URL, { usecase: "nlw_issuer" })
    expect(s.getState()).toMatchObject({ kind: "created", sameDeviceUl: OFFER, crossDeviceUl: OFFER, session: { sessionType: "cross_device" } })
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: OFFER })
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState()).toMatchObject({ kind: "error", errorType: "expired" })
  })

  it("follows an ID step (a new link on every poll, then in progress) to the offer", async () => {
    statuses(
      { status: "CREATED", ul: ID_STEP_1 },
      { status: "CREATED", ul: ID_STEP_2 },
      { status: "WAITING_FOR_RESPONSE" },
      { status: "CREATED", ul: OFFER },
    )
    const s = issuance()
    const seen: string[] = []
    s.subscribe((state) => seen.push(state.kind === "created" ? state.crossDeviceUl.toString() : state.kind))
    await s.start()
    for (let i = 0; i < 3; i++) await vi.advanceTimersToNextTimerAsync()
    expect(seen).toEqual(["creating", ID_STEP_1.toString(), ID_STEP_2.toString(), "in-progress", OFFER.toString()])
  })

  it("cancels the session when the dialog is closed before the offer was shown", async () => {
    statuses({ status: "CREATED", ul: ID_STEP_1 })
    const onDone = vi.fn()
    const s = issuance({ onDone })
    await s.start()
    await s.stop()
    expect(api.cancelSession).toHaveBeenCalledWith(STATUS_URL)
    expect(onDone).toHaveBeenCalledWith({ kind: "close" })
  })

  it("cancels an ID step that is stopped while the wallet is busy, as a disclosure", async () => {
    statuses({ status: "CREATED", ul: ID_STEP_1 }, { status: "WAITING_FOR_RESPONSE" })
    const s = issuance()
    await s.start()
    await vi.advanceTimersToNextTimerAsync()
    s.confirmStop()
    statuses({ status: "CANCELLED" })
    await s.stop()
    expect(api.cancelSession).toHaveBeenCalledWith(STATUS_URL)
    expect(s.getState()).toMatchObject({ kind: "error", errorType: "cancelled" })
  })

  it("never cancels the session once the offer was shown: a wallet may still be collecting it", async () => {
    statuses({ status: "CREATED", ul: ID_STEP_1 }, { status: "CREATED", ul: OFFER })
    const onDone = vi.fn()
    const s = issuance({ isMobile: true, onDone })
    await s.start()
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState()).toMatchObject({ kind: "created", sameDeviceUl: OFFER })
    await s.choose("same_device") // the phone opened the offer link
    await s.stop() // the close button
    expect(api.cancelSession).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledWith({ kind: "close" })
    api.getStatus.mockClear()
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.getStatus).not.toHaveBeenCalled()
  })

  it("keeps the offer on screen through a few failed status requests", async () => {
    statuses({ status: "CREATED", ul: OFFER })
    const s = issuance()
    await s.start()
    api.getStatus.mockRejectedValue("network")
    for (let i = 0; i < MAX_OFFER_POLL_FAILURES; i++) {
      await vi.advanceTimersToNextTimerAsync()
      expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: OFFER })
    }
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState()).toMatchObject({ kind: "error", errorType: "network" })
  })

  it("counts failed status requests anew once one gets through", async () => {
    statuses({ status: "CREATED", ul: OFFER })
    const s = issuance()
    await s.start()
    const fail = () => Promise.reject("failed")
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < MAX_OFFER_POLL_FAILURES; i++) {
        api.getStatus.mockImplementationOnce(fail)
        await vi.advanceTimersToNextTimerAsync()
      }
      await vi.advanceTimersToNextTimerAsync() // gets through
      expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: OFFER })
    }
  })

  it("shows the error of a failed status request before the offer, as a disclosure", async () => {
    statuses({ status: "CREATED", ul: ID_STEP_1 })
    const s = issuance()
    await s.start()
    api.getStatus.mockRejectedValueOnce("network")
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState()).toMatchObject({ kind: "error", errorType: "network" })
  })

  it("starts a new session on retry, which is cancelled again when closed before its offer", async () => {
    statuses({ status: "CREATED", ul: OFFER }, { status: "EXPIRED" }, { status: "CREATED", ul: ID_STEP_1 })
    const onDone = vi.fn()
    const s = issuance({ onDone })
    await s.start()
    await vi.advanceTimersToNextTimerAsync()
    expect(s.getState()).toMatchObject({ kind: "error", errorType: "expired" })
    await s.retry()
    expect(api.createSession).toHaveBeenCalledTimes(2)
    expect(s.getState()).toMatchObject({ kind: "created", crossDeviceUl: ID_STEP_1 })
    await s.stop()
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
  })

  it("does not treat an offer link as special without the issuance flag", async () => {
    api.getStatus.mockResolvedValue({ status: "CREATED", ul: OFFER })
    const s = session()
    await s.start()
    await s.stop()
    expect(api.cancelSession).toHaveBeenCalledWith(STATUS_URL)
  })
})

describe("WalletSession: slow session starts", () => {
  // the session of a start nobody waits for any more
  const LATE = new URL("https://wallet-connect.eu/api/issuance/sessions/late")
  const late = (ms: number) => delayed({ status_url: LATE, session_token: "late" }, ms)
  const onTime = (ms: number) => delayed({ status_url: STATUS_URL, session_token: TOKEN }, ms)

  /** Every state the session goes through: its kind, with the error type for an error. */
  const record = (s: WalletSession) => {
    const seen: string[] = []
    s.subscribe((state) => seen.push(state.kind === "error" ? `error:${state.errorType}` : state.kind))
    return seen
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllTimers()
    vi.resetAllMocks()
    api.createSession.mockResolvedValue({ status_url: STATUS_URL, session_token: TOKEN })
    api.getStatus.mockImplementation(async () => ({ status: "CREATED", ul: UL }))
    api.cancelSession.mockResolvedValue(undefined)
  })

  it("waits for a start that takes longer than a status request may (6 s)", async () => {
    api.createSession.mockImplementationOnce(onTime(6000))
    const s = session()
    const seen = record(s)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT + 1)
    expect(s.getState().kind).toBe("creating")
    await vi.advanceTimersByTimeAsync(6000 - REQUEST_TIMEOUT - 1)
    await started
    expect(s.getState()).toMatchObject({ kind: "created", session: { statusUrl: STATUS_URL, sessionToken: TOKEN } })
    expect(seen).toEqual(["creating", "created"])
    expect(api.cancelSession).not.toHaveBeenCalled()
  })

  it("shows the network error at START_TIMEOUT, then cancels the session that still comes (once) and never shows it", async () => {
    api.createSession.mockImplementationOnce(late(16000))
    const s = session()
    const seen = record(s)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT - 1)
    expect(s.getState().kind).toBe("creating")
    await vi.advanceTimersByTimeAsync(1)
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
    expect(api.cancelSession).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000) // the answer arrives at 16 s
    await started
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
    expect(api.cancelSession).toHaveBeenCalledWith(LATE)
    expect(api.getStatus).not.toHaveBeenCalled()
    expect(seen).toEqual(["creating", "error:network"])
    await vi.advanceTimersByTimeAsync(60000)
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
  })

  it("starts anew on retry after the timeout, and still cancels the first start's late session", async () => {
    api.createSession.mockImplementationOnce(late(20000)).mockImplementationOnce(onTime(1000))
    const s = session()
    const seen = record(s)
    void s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT)
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
    const retried = s.retry()
    expect(s.getState().kind).toBe("creating")
    await vi.advanceTimersByTimeAsync(1000)
    await retried
    expect(s.getState()).toMatchObject({ kind: "created", session: { statusUrl: STATUS_URL, sessionToken: TOKEN } })
    expect(api.cancelSession).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(4000) // the first answer arrives at 20 s
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
    expect(api.cancelSession).toHaveBeenCalledWith(LATE)
    // the retry's own session stays on screen, also once its start is START_TIMEOUT old
    await vi.advanceTimersByTimeAsync(START_TIMEOUT)
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionToken: TOKEN } })
    const [first, error, again, ...polled] = seen
    expect([first, error, again]).toEqual(["creating", "error:network", "creating"])
    expect(new Set(polled)).toEqual(new Set(["created"]))
    expect(api.getStatus.mock.calls.every(([url]) => url === STATUS_URL)).toBe(true)
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
  })

  it("ignores a start that fails after it was given up", async () => {
    api.createSession
      .mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 60000))
        throw "network"
      })
      .mockResolvedValueOnce({ status_url: STATUS_URL, session_token: TOKEN })
    const s = session()
    void s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT)
    await s.retry()
    expect(s.getState().kind).toBe("created")
    await vi.advanceTimersByTimeAsync(60000)
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionToken: TOKEN } })
    expect(api.cancelSession).not.toHaveBeenCalled()
  })

  it("cancels the late session of a start the dialog was closed during, and leaves the ended dialog alone", async () => {
    api.createSession.mockImplementationOnce(late(20000))
    const onDone = vi.fn()
    const s = session({ onDone })
    const seen = record(s)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(10000)
    s.close()
    expect(onDone).toHaveBeenCalledWith({ kind: "close" })
    await vi.advanceTimersByTimeAsync(10000) // past START_TIMEOUT, the answer arrives at 20 s
    await started
    expect(seen).toEqual(["creating"]) // no network error once the dialog has ended
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
    expect(api.cancelSession).toHaveBeenCalledWith(LATE)
    expect(api.getStatus).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("cancels the late session when the dialog is closed on the network error", async () => {
    api.createSession.mockImplementationOnce(late(20000))
    const onDone = vi.fn()
    const s = session({ onDone })
    const started = s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT + 1000)
    expect(s.getState()).toEqual({ kind: "error", errorType: "network" })
    s.close()
    s.dispose() // as the buttons do once the dialog is gone
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ kind: "failed" }))
    await vi.advanceTimersByTimeAsync(4000)
    await started
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
    expect(api.cancelSession).toHaveBeenCalledWith(LATE)
    expect(api.getStatus).not.toHaveBeenCalled()
  })

  it.each([
    ["before", 6000],
    ["after", 20000],
  ])("cancels the session of a start answered %s START_TIMEOUT when the dialog was unmounted meanwhile", async (_when, answerAt) => {
    api.createSession.mockImplementationOnce(late(answerAt))
    const s = session()
    const started = s.start()
    await vi.advanceTimersByTimeAsync(1000)
    s.dispose()
    await vi.advanceTimersByTimeAsync(answerAt)
    await started
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
    expect(api.cancelSession).toHaveBeenCalledWith(LATE)
    expect(api.getStatus).not.toHaveBeenCalled()
  })

  it("leaves a newer start alone when an older one runs out of time (React StrictMode), and cancels the older one's late session", async () => {
    api.createSession.mockImplementationOnce(late(20000)).mockImplementationOnce(onTime(1000))
    const s = session()
    const seen = record(s)
    const a = s.start()
    const b = s.start()
    await vi.advanceTimersByTimeAsync(20000)
    await Promise.all([a, b])
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionToken: TOKEN } })
    expect(seen.filter((kind) => kind.startsWith("error"))).toEqual([])
    expect(api.cancelSession).toHaveBeenCalledTimes(1)
    expect(api.cancelSession).toHaveBeenCalledWith(LATE)
  })

  it("shows a session whose start took almost START_TIMEOUT, also when its first status takes longer", async () => {
    api.createSession.mockImplementationOnce(onTime(START_TIMEOUT - 1000))
    api.getStatus.mockImplementationOnce(delayed({ status: "CREATED", ul: UL }, 2000))
    const s = session()
    const seen = record(s)
    const started = s.start()
    await vi.advanceTimersByTimeAsync(START_TIMEOUT + 1000)
    await started
    expect(s.getState()).toMatchObject({ kind: "created", session: { sessionToken: TOKEN } })
    expect(seen).toEqual(["creating", "created"])
    expect(api.cancelSession).not.toHaveBeenCalled()
  })

  it("leaves no timer behind once the start is answered", async () => {
    api.getStatus.mockResolvedValue({ status: "DONE" }) // a final state: nothing is polled
    const s = session()
    await s.start()
    expect(s.getState().kind).toBe("success")
    expect(vi.getTimerCount()).toBe(0)
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
