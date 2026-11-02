import type { Brand } from "../brands/types"
import { defaultFetch, fetchApi, type Fetch } from "../session/api"
import { StaticSession, WalletSession, type SessionDriver, type SessionOutcome } from "../session/WalletSession"
import { resolveLanguage, translations, type Language, type Translate } from "../translations"
import { detectDevice, type Device } from "../useragent"
import { fetchDisclosedAttributes, type DisclosedAttributesResponse } from "./disclosed"
import { buildStartUrl, buildStaticUniversalLinks, resolveHelpBaseUrl, resolveHost, resolveReturnUrl } from "./hosts"
import { sessionFromMessage, type SessionParams } from "./iframe"
import { fetchRequestedCredentials, type RequestedCredential } from "./requested"
import { clearSessionParams, readSessionParams, writeSessionParams } from "./urlParams"

/** The options every button exposes, in their 1.x names. */
export interface WalletConnectOptions {
  brand: Brand
  /** The registration's identifier (`serviceId` / `clientId` in the button props, same value). */
  clientId?: string
  apiKey?: string
  useLocalWcServer?: boolean
  issuance?: boolean
  lang?: string | null
  helpBaseUrl?: string | null
  returnUrl?: string | null
  label?: string | null
  onSuccess?: (attributes: DisclosedAttributesResponse) => void
  onFailed?: (outcome: SessionOutcome) => void
  fetch?: Fetch
  /** The page's window; defaults to the global one and may be absent on a server. */
  win?: Window
}

export type ConnectPhase = { kind: "idle" } | { kind: "checking" } | { kind: "error"; message: string }

export interface ConnectState {
  /** What the button area shows: the button, the "checking attributes" card, or an error card. */
  phase: ConnectPhase
  /** Credentials the registration asks for; shown in the dialog once loaded. */
  credentials: RequestedCredential[]
}

export type ConnectListener = (state: ConnectState) => void

/**
 * Everything around the dialog that the three 1.x buttons each implemented: which server to talk to,
 * picking up the session token the wallet leaves in the URL (or a host page posts into an iframe),
 * fetching the disclosed attributes, and the "required credentials" list.
 */
export class WalletConnectController {
  readonly brand: Brand
  readonly lang: Language
  readonly t: Translate
  readonly host: string
  readonly helpBaseUrl: URL
  readonly clientId: string
  readonly issuance: boolean

  private state: ConnectState = { phase: { kind: "idle" }, credentials: [] }
  private readonly listeners = new Set<ConnectListener>()
  private readonly fetch: Fetch
  private readonly win: Window | undefined
  private mounted = false

  constructor(private readonly options: WalletConnectOptions) {
    this.brand = options.brand
    this.lang = resolveLanguage(options.lang)
    this.t = translations(this.lang, this.brand.translations)
    this.issuance = options.issuance ?? false
    this.host = resolveHost(this.brand, { issuance: this.issuance, useLocalWcServer: options.useLocalWcServer })
    this.helpBaseUrl = resolveHelpBaseUrl(this.brand, options.helpBaseUrl)
    this.clientId = options.clientId ?? ""
    this.fetch = options.fetch ?? defaultFetch
    this.win = options.win ?? (typeof window !== "undefined" ? window : undefined)
  }

  getState(): ConnectState {
    return this.state
  }

  subscribe(listener: ConnectListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setState(patch: Partial<ConnectState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }

  /** The button text: the label option, else the brand's own. */
  get label(): string {
    return this.options.label || this.t("wallet_button_text")
  }

  get device(): Device {
    return detectDevice(this.win?.navigator)
  }

  /** Where the wallet sends the user after a same-device disclosure. */
  get returnUrl(): string {
    return resolveReturnUrl(this.options.returnUrl, this.win?.location.href ?? "")
  }

  /** The session-creating endpoint: the server itself with an API key, else the page's own backend. */
  get startUrl(): URL {
    const url = buildStartUrl(this.options.apiKey ? this.host : "", this.returnUrl)
    return new URL(url, this.win?.location.href ?? "http://localhost/")
  }

  /** The fixed links of an issuance; undefined for a disclosure, which creates its session dynamically. */
  get staticLinks(): { sameDeviceUl: URL; crossDeviceUl: URL } | undefined {
    return this.issuance ? buildStaticUniversalLinks(this.brand, this.host, this.clientId) : undefined
  }

  /** Whether the dialog shows download badges per role (NB only, with a registration id, for a disclosure). */
  get showRoleBadges(): boolean {
    return !!this.brand.store && !!this.clientId && !this.issuance
  }

  /** Whether the dialog shows one download badge for any wallet holder (NB issuance). */
  get showHolderBadge(): boolean {
    return !!this.brand.store && !!this.clientId && this.issuance
  }

  /** Start listening for a returning session (URL, popstate, iframe message) and handle one already present. */
  mount(): void {
    if (this.mounted || !this.win) return
    this.mounted = true
    this.win.addEventListener("popstate", this.onPopState)
    this.win.addEventListener("message", this.onMessage)
    this.checkForSession()
  }

  unmount(): void {
    if (!this.mounted || !this.win) return
    this.mounted = false
    this.win.removeEventListener("popstate", this.onPopState)
    this.win.removeEventListener("message", this.onMessage)
  }

  private readonly onPopState = () => this.checkForSession()

  private readonly onMessage = (event: MessageEvent) => {
    const session = sessionFromMessage(event, this.returnUrl)
    if (!session || !this.win) return
    writeSessionParams(this.win, session)
    this.checkForSession()
  }

  /** A session driver for one dialog opening. The outcome of the dialog is forwarded to `onDone`. */
  createSession(onDone: (outcome: SessionOutcome) => void): SessionDriver {
    const isMobile = this.device.isMobile
    const done = (outcome: SessionOutcome) => {
      if (outcome.kind === "success" && outcome.sessionType === "cross_device" && this.win) {
        // A same-device disclosure returns via the URL; cross-device we put the token there ourselves.
        writeSessionParams(this.win, { session_token: outcome.sessionToken })
        this.checkForSession()
      }
      if (outcome.kind === "failed") this.options.onFailed?.(outcome)
      onDone(outcome)
    }
    const links = this.staticLinks
    if (links) return new StaticSession({ ...links, isMobile, onDone: done })
    return new WalletSession({
      startUrl: this.startUrl,
      usecase: this.clientId,
      isMobile,
      api: fetchApi(this.fetch),
      onDone: done,
    })
  }

  /** Load the registration's requested credentials (needs an API key); failures only log. */
  async loadRequestedCredentials(): Promise<RequestedCredential[]> {
    if (!this.options.apiKey || !this.clientId) return []
    try {
      const credentials = await fetchRequestedCredentials(
        { host: this.host, apiKey: this.options.apiKey, idPath: this.brand.idPath, clientId: this.clientId },
        this.fetch,
      )
      this.setState({ credentials })
      return credentials
    } catch (e) {
      console.error("Failed to fetch credentials:", e)
      return []
    }
  }

  private checkForSession(): void {
    if (!this.win) return
    const session = readSessionParams(this.win.location.search)
    if (session) void this.fetchAttributes(session)
  }

  private async fetchAttributes(session: SessionParams): Promise<void> {
    this.setState({ phase: { kind: "checking" } })
    try {
      const data = await fetchDisclosedAttributes(
        {
          host: this.host,
          apiKey: this.options.apiKey,
          idParam: this.brand.idParam,
          clientId: this.clientId,
          sessionToken: session.session_token,
          nonce: session.nonce,
        },
        this.fetch,
      )
      this.options.onSuccess?.(data)
      this.setState({ phase: { kind: "idle" } })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.log(message)
      this.setState({ phase: { kind: "error", message } })
    } finally {
      if (this.win) clearSessionParams(this.win)
    }
  }
}
