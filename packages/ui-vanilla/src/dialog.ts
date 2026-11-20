import {
  COPIED_MS,
  copyToClipboard,
  type FooterCommand,
  type InstallRole,
  type SessionDriver,
  type SessionOutcome,
  type SessionType,
  type WalletConnectController,
} from "@wallet-connect/core"
import { renderModal, type ModalContext } from "./modal"

export interface WalletDialogOptions {
  controller: WalletConnectController
  /** Where the overlay is appended: the element's shadow root, or any container. */
  root: ParentNode
  /** Called once when the dialog is gone, with how it ended. */
  onClosed: (outcome: SessionOutcome) => void
}

/**
 * One opening of the wallet dialog: owns the session, the install-view state, and re-renders the
 * modal on every change. Plain DOM, no framework.
 */
export class WalletDialog {
  private readonly session: SessionDriver
  private installRole: InstallRole | null = null
  private element: HTMLElement | null = null
  private readonly unsubscribe: Array<() => void> = []
  private finished = false
  /** "Copy link": the link copied last (shown as "Copied" for a moment), and whether the manual field is open. */
  private copiedLink: string | null = null
  private copiedTimer: ReturnType<typeof setTimeout> | undefined
  private manualCopy = false

  constructor(private readonly options: WalletDialogOptions) {
    this.session = options.controller.createSession((outcome) => this.finish(outcome))
  }

  open(): void {
    const { controller } = this.options
    this.unsubscribe.push(
      this.session.subscribe((state) => {
        // the install view is a view on the created state only
        if (state.kind !== "created") this.installRole = null
        this.render()
      }),
      controller.subscribe(() => this.render()),
    )
    this.render()
    // focus the dialog body once it is in the DOM, as ModalMain.vue did
    setTimeout(() => this.element?.querySelector<HTMLElement>("main")?.focus(), 0)
    void this.session.start()
    void controller.loadRequestedCredentials()
  }

  /** Close from outside (e.g. the element is removed from the page). */
  destroy(): void {
    if (!this.finished) this.finish({ kind: "close" })
  }

  private command(command: FooterCommand) {
    switch (command) {
      case "confirmStop":
        this.session.confirmStop()
        break
      case "stop":
        void this.session.stop()
        break
      case "retry":
        void this.session.retry()
        break
      case "installed":
        this.installRole = null
        this.render()
        break
      case "close":
        this.session.close()
        break
      case "back":
        void this.session.back()
        break
    }
  }

  private context(): ModalContext {
    const c = this.options.controller
    return {
      state: this.session.getState(),
      installRole: this.installRole,
      brand: c.brand,
      t: c.t,
      lang: c.lang,
      device: c.device,
      helpBaseUrl: c.helpBaseUrl,
      clientId: c.clientId || undefined,
      issuance: c.issuance,
      credentials: c.getState().credentials,
      copyLink: { copied: this.copiedLink, manual: this.manualCopy },
      on: {
        copy: (link: string) => void this.copy(link),
        choose: (sessionType: SessionType) => void this.session.choose(sessionType),
        command: (command) => this.command(command),
        install: (role) => {
          this.installRole = role
          this.render()
        },
        headerBack: () => {
          this.installRole = null
          this.render()
        },
      },
    }
  }

  private async copy(link: string) {
    if (await copyToClipboard(link)) {
      this.copiedLink = link
      if (this.copiedTimer) clearTimeout(this.copiedTimer)
      this.copiedTimer = setTimeout(() => {
        this.copiedLink = null
        this.render()
      }, COPIED_MS)
      this.render()
    } else if (!this.manualCopy) {
      this.manualCopy = true
      this.render()
      // the whole modal is redrawn on every change, so focus the new field once, when it opens
      const field = this.element?.querySelector<HTMLInputElement>("[data-testid=copy_link_manual]")
      field?.focus()
      field?.select()
    }
  }

  private render() {
    if (this.finished) return
    const next = renderModal(this.context())
    if (this.element) {
      this.element.replaceWith(next)
    } else {
      this.options.root.appendChild(next)
    }
    this.element = next
  }

  private finish(outcome: SessionOutcome) {
    if (this.finished) return
    this.finished = true
    if (this.copiedTimer) clearTimeout(this.copiedTimer)
    for (const off of this.unsubscribe) off()
    this.session.dispose()
    this.element?.remove()
    this.element = null
    this.options.onClosed(outcome)
  }
}
