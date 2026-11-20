import { errorTypeOrDefault } from "../error_type"
import { fetchApi, START_TIMEOUT, type SessionApi } from "./api"
import type { SessionType } from "./openid4vc"
import type { SessionResponse } from "./relying_party"
import type { ModalState, Session } from "./state"

export const POLL_INTERVAL_IN_MS = 2000

/**
 * Status requests in a row that may fail while a credential offer is on screen before the dialog shows the
 * error. The offer stays valid whatever happens to this page's polling, so a short hiccup of the server
 * should not take it away.
 */
export const MAX_OFFER_POLL_FAILURES = 3

/** Whether a link is a credential offer (OpenID4VCI), not a presentation request (an ID step or a disclosure). */
export const isCredentialOffer = (ul: URL): boolean =>
  ul.protocol === "openid-credential-offer:" || ul.protocol === "haip-vci:"

/**
 * How the dialog ended: the user closed it after success or failure, or left early. Closing an issuance
 * after its credential offer was shown is a `close` as well: the session is left to expire, and nothing
 * tells whether the wallet collected the credential.
 */
export type SessionOutcome =
  | { kind: "success"; sessionToken: string; sessionType: SessionType }
  | { kind: "failed"; sessionToken?: string; sessionType?: SessionType }
  | { kind: "close" }

export type StateListener = (state: ModalState) => void

/** What every modal renders against, whether the session is dynamic (server) or static (fixed links). */
export interface SessionDriver {
  getState(): ModalState
  subscribe(listener: StateListener): () => void
  /** Kick off: create the session and fetch its first status. */
  start(): Promise<void>
  /** Mobile only: continue on this device (link) or another device (QR code). */
  choose(sessionType: SessionType): Promise<void>
  /** Cancel the session; from the created screen this also ends the dialog. */
  stop(): Promise<void>
  /** Ask "are you sure?" while the wallet is busy. */
  confirmStop(): void
  /** Leave the "are you sure?" screen. */
  back(): Promise<void>
  /** Start over after an error. */
  retry(): Promise<void>
  /** The close button: ends the dialog with the outcome of the current state. */
  close(): void
  /** Stop polling and drop listeners (unmount). */
  dispose(): void
}

export interface WalletSessionOptions {
  startUrl: URL
  usecase: string
  /** The JSON body of the start request; wallet-connect's `{ usecase }` by default. */
  startBody?: unknown
  /** A phone starts with a same-device link, a desktop with a QR code. */
  isMobile: boolean
  /**
   * An issuance on the WE BUILD lane. Its status hands out the credential offer (after an ID step, if the
   * issuer has one) and then stays CREATED until the offer expires: the lane never reports DONE for an
   * issuance. Once the offer has been shown, the dialog never cancels the session (a wallet may still be
   * collecting the credential), and a few failed status requests leave the offer on screen.
   */
  issuance?: boolean
  pollIntervalInMs?: number
  api?: SessionApi
  onDone?: (outcome: SessionOutcome) => void
}

export class WalletSession implements SessionDriver {
  private state: ModalState = { kind: "creating" }
  private readonly listeners = new Set<StateListener>()
  private pollHandle: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private readonly api: SessionApi
  private readonly pollIntervalInMs: number
  /**
   * Bumped by every request and every user action: only the newest may change the state. An answer that
   * arrives after the user moved on (or after a newer start, e.g. React StrictMode's second effect run)
   * is ignored.
   */
  private seq = 0
  /** This run's credential offer has been on screen: from now on the dialog does not cancel the session. */
  private offerShown = false
  /** Failed status requests in a row while the offer is on screen. */
  private offerPollFailures = 0

  constructor(private readonly options: WalletSessionOptions) {
    this.api = options.api ?? fetchApi()
    this.pollIntervalInMs = options.pollIntervalInMs ?? POLL_INTERVAL_IN_MS
  }

  getState(): ModalState {
    return this.state
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setState(state: ModalState) {
    if (this.disposed) return
    this.state = state
    // the same scheduling the Vue version did in its `watch(modalState)`
    switch (state.kind) {
      case "created":
      case "in-progress":
        this.pollStatus(state.session)
        break
      default:
        this.cancelPolling()
    }
    for (const listener of this.listeners) listener(state)
  }

  private fail(session?: Session) {
    this.seq += 1
    this.setState({ kind: "error", errorType: "failed", session })
  }

  private sessionOf(state: ModalState): Session | undefined {
    return state.kind !== "creating" ? state.session : undefined
  }

  private finish(outcome: SessionOutcome) {
    // whatever is still in flight belongs to a dialog that has ended
    this.seq += 1
    this.cancelPolling()
    this.options.onDone?.(outcome)
  }

  /** Best effort: cancel a session that nobody shows or follows any more. */
  private abandon(statusUrl: URL) {
    this.api.cancelSession(statusUrl).catch(() => undefined)
  }

  private pollStatus(session: Session) {
    this.cancelPolling()
    this.pollHandle = setTimeout(() => void this.checkStatus(session), this.pollIntervalInMs)
  }

  private cancelPolling() {
    if (this.pollHandle !== undefined) {
      clearTimeout(this.pollHandle)
      this.pollHandle = undefined
    }
  }

  /**
   * Create the session for the start numbered `seq`, waiting at most START_TIMEOUT. Then the dialog shows the
   * network error and moves on (a new seq), but the request stays open: an answer that still comes is
   * handled like every answer nobody waits for any more, so `start` cancels its session and never shows it.
   */
  private async requestSession(seq: number): Promise<SessionResponse> {
    const giveUp = setTimeout(() => {
      if (seq !== this.seq) return // closed, or replaced by a newer start: nobody waits for this one
      this.seq += 1
      this.setState({ kind: "error", errorType: "network" })
    }, START_TIMEOUT)
    try {
      const body = this.options.startBody ?? { usecase: this.options.usecase }
      return await this.api.createSession(this.options.startUrl, body)
    } finally {
      // the start's answer is in: the first status request has a timeout of its own
      clearTimeout(giveUp)
    }
  }

  async start(): Promise<void> {
    const seq = ++this.seq
    this.offerShown = false
    this.offerPollFailures = 0
    try {
      this.setState({ kind: "creating" })
      const response = await this.requestSession(seq)
      if (this.disposed || seq !== this.seq) {
        // The dialog gave up waiting (START_TIMEOUT) or closed while the session was being created, or a
        // newer start replaced this one: its links were never shown, so nobody needs the session.
        this.abandon(response.status_url)
        return
      }
      await this.checkStatus({
        statusUrl: response.status_url,
        sessionType: this.options.isMobile ? "same_device" : "cross_device",
        sessionToken: response.session_token,
      })
    } catch (e) {
      if (seq !== this.seq) return
      this.setState({ kind: "error", errorType: errorTypeOrDefault(e) })
    }
  }

  private async checkStatus(session: Session): Promise<void> {
    const seq = ++this.seq
    try {
      const status = await this.api.getStatus(session.statusUrl, session.sessionType)
      if (this.disposed || seq !== this.seq) return
      this.offerPollFailures = 0
      switch (status.status) {
        case "CREATED":
          if (status.ul !== undefined) {
            if (this.options.issuance && isCredentialOffer(status.ul)) this.offerShown = true
            this.setState({ kind: "created", sameDeviceUl: status.ul, crossDeviceUl: status.ul, session })
          } else {
            this.setState({ kind: "error", errorType: "failed" })
          }
          break
        case "WAITING_FOR_RESPONSE":
          this.setState({ kind: "in-progress", session })
          break
        case "DONE":
          this.setState({ kind: "success", session })
          break
        case "EXPIRED":
          this.setState({ kind: "error", errorType: "expired", session })
          break
        case "CANCELLED":
          this.setState({ kind: "error", errorType: "cancelled", session })
          break
        case "FAILED":
          this.setState({ kind: "error", errorType: "failed", session })
          break
      }
    } catch (e) {
      if (this.disposed || seq !== this.seq) return
      if (this.offerShown && this.state.kind === "created" && ++this.offerPollFailures <= MAX_OFFER_POLL_FAILURES) {
        // the offer on screen is still valid: keep it there and ask again
        this.pollStatus(session)
        return
      }
      this.setState({ kind: "error", errorType: errorTypeOrDefault(e), session })
    }
  }

  async choose(sessionType: SessionType): Promise<void> {
    const state = this.state
    if (state.kind !== "created") return this.fail(this.sessionOf(state))

    this.cancelPolling()
    const session: Session = { ...state.session, sessionType }
    if (sessionType === "cross_device") this.setState({ kind: "loading", session })
    await this.checkStatus(session)
  }

  close(): void {
    const state = this.state
    switch (state.kind) {
      case "success":
        this.finish({ kind: "success", sessionToken: state.session.sessionToken, sessionType: state.session.sessionType })
        break
      case "error":
        this.finish({ kind: "failed", sessionToken: state.session?.sessionToken, sessionType: state.session?.sessionType })
        break
      case "creating":
      case "loading":
        this.finish({ kind: "close" })
        break
      default:
        this.fail(state.session)
    }
  }

  async stop(): Promise<void> {
    const state = this.state
    if (state.kind !== "created" && state.kind !== "confirm-stop") return this.fail(this.sessionOf(state))

    // A wallet may still be collecting the credential offer: leave the session to expire on its own.
    if (this.offerShown) return this.finish({ kind: "close" })

    this.seq += 1
    this.setState({ kind: "loading", session: state.session })
    try {
      await this.api.cancelSession(state.session.statusUrl)
    } catch (e) {
      console.error(e)
    }
    if (state.kind === "created") {
      this.finish({ kind: "close" })
    } else {
      await this.checkStatus(state.session)
    }
  }

  async retry(): Promise<void> {
    if (this.state.kind !== "error") return this.fail(this.sessionOf(this.state))
    await this.start()
  }

  confirmStop(): void {
    const state = this.state
    if (state.kind !== "loading" && state.kind !== "in-progress") return this.fail(this.sessionOf(state))
    this.seq += 1
    this.setState({ kind: "confirm-stop", prev: state, session: state.session })
  }

  async back(): Promise<void> {
    const state = this.state
    if (state.kind !== "confirm-stop") return this.fail(this.sessionOf(state))

    const prev = state.prev
    if (prev.kind !== "creating" && prev.session !== undefined) {
      this.setState(prev)
      await this.checkStatus(prev.session)
    } else {
      this.setState({ kind: "error", errorType: "failed" })
    }
  }

  dispose(): void {
    this.cancelPolling()
    this.disposed = true
    this.listeners.clear()
  }
}

export interface StaticSessionOptions {
  sameDeviceUl: URL
  crossDeviceUl: URL
  isMobile: boolean
  onDone?: (outcome: SessionOutcome) => void
}

/**
 * The static strategy (issuance): the links are known up front and nothing is polled,
 * so the dialog only ever shows the created screen.
 */
export class StaticSession implements SessionDriver {
  private state: ModalState
  private readonly listeners = new Set<StateListener>()

  constructor(private readonly options: StaticSessionOptions) {
    this.state = {
      kind: "created",
      sameDeviceUl: options.sameDeviceUl,
      crossDeviceUl: options.crossDeviceUl,
      session: {
        // unused in static mode (PVW-4365 upstream)
        statusUrl: new URL("http://status.example.com/status"),
        sessionType: options.isMobile ? "same_device" : "cross_device",
        sessionToken: "",
      },
    }
  }

  getState(): ModalState {
    return this.state
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {}

  async choose(sessionType: SessionType): Promise<void> {
    if (this.state.kind !== "created") return
    this.state = { ...this.state, session: { ...this.state.session, sessionType } }
    for (const listener of this.listeners) listener(this.state)
  }

  async stop(): Promise<void> {
    this.options.onDone?.({ kind: "close" })
  }

  close(): void {
    this.options.onDone?.({ kind: "close" })
  }

  confirmStop(): void {}
  async back(): Promise<void> {}
  async retry(): Promise<void> {}

  dispose(): void {
    this.listeners.clear()
  }
}
