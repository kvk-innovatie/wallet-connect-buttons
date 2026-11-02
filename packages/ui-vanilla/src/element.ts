import {
  WalletConnectController,
  ensureStyles,
  selectBrand,
  type BrandSet,
  type ConnectState,
  type Fetch,
  type SessionOutcome,
} from "@wallet-connect/core"
import { WalletDialog } from "./dialog"
import { h } from "./dom"

export interface DefineOptions {
  /** Registers font faces on the page (the default package entry passes core/fonts ensureFonts; the slim entry nothing). */
  fonts?: (doc: Document) => void
  /** Alternative fetch, mainly for tests. */
  fetch?: Fetch
  /** Shown once when the `nbwallet` attribute is used on a package that has no NB brand. */
  nbwalletWarning?: string
}

/** The attribute names the 1.x element accepted, camelCase and kebab-case alike. */
export const OBSERVED_ATTRIBUTES = [
  "clientid",
  "client-id",
  "serviceid",
  "service-id",
  "apikey",
  "api-key",
  "use-local-wc-server",
  "label",
  "lang",
  "helpbaseurl",
  "help-base-url",
  "returnurl",
  "return-url",
  "issuance",
  "business",
  "over18",
  "nbwallet",
] as const

const attr = (el: HTMLElement, ...names: string[]): string | undefined => {
  for (const name of names) {
    const value = el.getAttribute(name)
    if (value !== null) return value
  }
  return undefined
}

/** An instance of the button element. */
export interface WalletConnectButtonElement extends HTMLElement {
  /** The controller behind this element (read-only; for tests and advanced integrations). */
  readonly walletConnect: WalletConnectController | null
}

/** The element class a package registers. */
export interface WalletConnectButtonElementClass {
  new (): WalletConnectButtonElement
  readonly version: string
  readonly observedAttributes: readonly string[]
  readonly prototype: WalletConnectButtonElement
}

/**
 * Build the custom element class for a tag and brand set, and register it unless the tag is taken.
 * Returns the class either way.
 */
export const defineWalletConnectButton = (
  tagName: string,
  brands: BrandSet,
  options: DefineOptions = {},
): WalletConnectButtonElementClass => {
  let warned = false

  class Element extends HTMLElement implements WalletConnectButtonElement {
    static readonly version: string = __WCB_VERSION__
    static get observedAttributes(): readonly string[] {
      return OBSERVED_ATTRIBUTES
    }

    private readonly root: ShadowRoot
    private controller: WalletConnectController | null = null
    private dialog: WalletDialog | null = null
    private trigger: HTMLButtonElement | null = null
    private card: HTMLElement | null = null
    private unsubscribe: (() => void) | null = null

    constructor() {
      super()
      this.root = this.attachShadow({ mode: "open" })
    }

    connectedCallback(): void {
      ensureStyles(this.root)
      options.fonts?.(this.ownerDocument)
      this.setup()
    }

    disconnectedCallback(): void {
      this.teardown()
    }

    attributeChangedCallback(): void {
      if (this.isConnected && this.controller) this.setup()
    }

    /** The controller behind this element (read-only; for tests and advanced integrations). */
    get walletConnect(): WalletConnectController | null {
      return this.controller
    }

    private setup() {
      this.teardown()
      const flags = {
        business: this.hasAttribute("business"),
        over18: this.hasAttribute("over18"),
        nbwallet: this.hasAttribute("nbwallet"),
      }
      if (flags.nbwallet && !brands.nbwallet && options.nbwalletWarning && !warned) {
        warned = true
        console.warn(options.nbwalletWarning)
      }
      this.controller = new WalletConnectController({
        brand: selectBrand(brands, flags),
        clientId: attr(this, "serviceId", "serviceid", "service-id", "clientId", "clientid", "client-id"),
        apiKey: attr(this, "apiKey", "apikey", "api-key"),
        useLocalWcServer: this.hasAttribute("use-local-wc-server"),
        issuance: this.hasAttribute("issuance"),
        lang: attr(this, "lang"),
        helpBaseUrl: attr(this, "helpBaseUrl", "helpbaseurl", "help-base-url"),
        returnUrl: attr(this, "returnUrl", "returnurl", "return-url"),
        label: attr(this, "label"),
        fetch: options.fetch,
        onSuccess: (attributes) => this.dispatchEvent(new CustomEvent("success", { detail: attributes, bubbles: true, composed: true })),
        onFailed: (outcome) => this.dispatchEvent(new CustomEvent("failed", { detail: failedDetail(outcome), bubbles: true, composed: true })),
      })
      this.unsubscribe = this.controller.subscribe((state) => this.renderCard(state))
      this.renderTrigger()
      this.renderCard(this.controller.getState())
      this.controller.mount()
    }

    private teardown() {
      this.dialog?.destroy()
      this.dialog = null
      this.unsubscribe?.()
      this.unsubscribe = null
      this.controller?.unmount()
      this.controller = null
      this.trigger?.remove()
      this.trigger = null
      this.card?.remove()
      this.card = null
    }

    private renderTrigger() {
      const controller = this.controller as WalletConnectController
      this.trigger = h(
        "button",
        { part: "button", class: "wcb-button", type: "button", "data-testid": "wallet_button", onclick: () => this.openDialog() },
        h("span", { part: "button-span", class: "wcb-button__label" }, controller.label),
      )
      this.root.appendChild(this.trigger)
    }

    /** The 1.x placeholder cards while attributes are fetched or when that failed; unstyled, as before. */
    private renderCard(state: ConnectState) {
      this.card?.remove()
      this.card = null
      const phase = state.phase
      if (phase.kind === "idle") {
        this.trigger?.removeAttribute("hidden")
        return
      }
      this.trigger?.setAttribute("hidden", "")
      this.card = h(
        "div",
        { class: "attributes", "data-testid": phase.kind === "checking" ? "checking_attributes" : "attributes_error" },
        h(
          "div",
          { class: "verification-card" },
          h("h2", {}, phase.kind === "checking" ? "Checking attributes..." : "Error"),
          h(
            "p",
            {},
            phase.kind === "checking"
              ? "Please wait while we verify your attributes."
              : `An error occurred while verifying your attributes: ${phase.message}`,
          ),
        ),
      )
      this.root.appendChild(this.card)
    }

    private openDialog() {
      if (!this.controller || this.dialog) return
      this.trigger?.setAttribute("aria-hidden", "true")
      this.dialog = new WalletDialog({
        controller: this.controller,
        root: this.root,
        onClosed: () => {
          this.dialog = null
          this.trigger?.removeAttribute("aria-hidden")
          this.trigger?.focus()
        },
      })
      this.dialog.open()
    }
  }

  if (typeof customElements !== "undefined") {
    const existing = customElements.get(tagName)
    if (!existing) {
      customElements.define(tagName, Element)
    } else if ((existing as { version?: string }).version !== Element.version) {
      console.warn(`<${tagName}> is already defined by another version (${(existing as { version?: string }).version ?? "unknown"}); this one (${Element.version}) is not registered.`)
    }
  }
  return Element as unknown as WalletConnectButtonElementClass
}

/** The `failed` event detail, in the 1.x shape: the inner `[session_token, session_type]` pair. */
const failedDetail = (outcome: SessionOutcome): unknown[] =>
  outcome.kind === "failed" ? [outcome.sessionToken, outcome.sessionType] : []

