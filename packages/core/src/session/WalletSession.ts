import { errorTypeOrDefault } from "../error_type"
import { fetchApi, type SessionApi } from "./api"
import type { SessionType } from "./openid4vc"
import type { ModalState, Session } from "./state"

export const POLL_INTERVAL_IN_MS = 2000

/** How the dialog ended: the user closed it after success or failure, or left early. */
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
  /** A phone starts with a same-device link, a desktop with a QR code. */
  isMobile: boolean
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
    this.setState({ kind: "error", errorType: "failed", session })
  }

  private sessionOf(state: ModalState): Session | undefined {
    return state.kind !== "creating" ? state.session : undefined
  }

  private finish(outcome: SessionOutcome) {
    this.cancelPolling()
    this.options.onDone?.(outcome)
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

  async start(): Promise<void> {
    try {
      this.setState({ kind: "creating" })
      const response = await this.api.createSession(this.options.startUrl, { usecase: this.options.usecase })
      await this.checkStatus({
        statusUrl: response.status_url,
        sessionType: this.options.isMobile ? "same_device" : "cross_device",
        sessionToken: response.session_token,
      })
    } catch (e) {
      this.setState({ kind: "error", errorType: errorTypeOrDefault(e) })
    }
  }

  private async checkStatus(session: Session): Promise<void> {
    try {
      const status = await this.api.getStatus(session.statusUrl, session.sessionType)
      if (this.disposed) return
      switch (status.status) {
        case "CREATED":
          if (status.ul !== undefined) {
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
