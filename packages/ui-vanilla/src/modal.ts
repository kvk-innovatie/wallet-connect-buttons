import {
  ICONS,
  drawCanvas,
  footerActions,
  mainView,
  modalClassNames,
  onboardingLink,
  onboardingParams,
  qrcodegen,
  showBackArrow,
  showHelpSection,
  storeForDevice,
  storeUrl,
  type Brand,
  type Device,
  type FooterCommand,
  type InstallRole,
  type ModalState,
  type RequestedCredential,
  type SessionType,
  type Store,
  type Translate,
} from "@wallet-connect/core"
import { h, svg } from "./dom"

/** Everything the dialog needs to draw one frame. */
export interface ModalContext {
  state: ModalState
  installRole: InstallRole | null
  brand: Brand
  t: Translate
  lang: "nl" | "en"
  device: Device
  helpBaseUrl: URL
  clientId?: string
  issuance: boolean
  credentials: RequestedCredential[]
  /** "Copy link" under the QR code: the link copied last (for "Copied"), and whether to show it to copy by hand. */
  copyLink: { copied: string | null; manual: boolean }
  on: {
    copy(link: string): void
    choose(sessionType: SessionType): void
    command(command: FooterCommand): void
    install(role: InstallRole): void
    headerBack(): void
  }
}

const icon = (d: string) => svg(d, { size: 16 })

/** The footer actions name their icon; look the path up (ModalFooter.vue / WalletModal.tsx do the same). */
const footerIcon = (name: string) => ICONS[name as "cancel" | "retry" | "check" | "close" | "back"]

const action = (
  ctx: ModalContext,
  opts: { testId: string; variant: string; word: Parameters<Translate>[0]; icon: string; command: FooterCommand },
) =>
  h(
    "button",
    {
      type: "button",
      class: `wcb-action wcb-${opts.variant}`,
      "data-testid": opts.testId,
      onclick: () => ctx.on.command(opts.command),
    },
    icon(footerIcon(opts.icon)),
    h("span", {}, ctx.t(opts.word)),
  )

export const renderHeader = (ctx: ModalContext): HTMLElement =>
  h(
    "header",
    {},
    showBackArrow(ctx.state, ctx.installRole) &&
      h(
        "button",
        { type: "button", class: "wcb-back", "aria-label": ctx.t("back"), "data-testid": "back_header_button", onclick: () => ctx.on.headerBack() },
        svg(ICONS.back, { size: 24, ariaHidden: true }),
      ),
    h("h1", {}, ctx.t("modal_header")),
  )

export const renderQrCode = (ctx: ModalContext, ul: URL, title?: string): HTMLElement[] => {
  const canvas = h("canvas")
  // MEDIUM recovers 15% of the code: the logo overlay hides about 5% of the modules, which LOW (7%) cannot reliably absorb.
  drawCanvas(qrcodegen.QrCode.encodeText(ul.toString(), qrcodegen.QrCode.Ecc.MEDIUM), canvas)
  return [
    h("h2", {}, title ?? ctx.t("qr_code_title")),
    h("div", { class: "wcb-qr", "data-testid": "qr" }, canvas, h("div", { role: "img", class: "wcb-logo", "aria-label": ctx.t("qr_code_label") })),
  ]
}

/**
 * "Copy link" under the session's QR code: puts the link the code encodes on the clipboard (e.g. for a wallet
 * on this computer or a test wallet that cannot scan). Without clipboard access it shows the link to copy by hand.
 */
export const renderCopyLink = (ctx: ModalContext, ul: URL): HTMLElement => {
  const link = ul.toString()
  // an ID step hands out a new link every few seconds: "Copied" belongs to the link that was copied
  const copied = ctx.copyLink.copied === link
  return h(
    "div",
    { class: "wcb-copy" },
    h(
      "button",
      { type: "button", class: "wcb-action wcb-link", "data-testid": "copy_link_button", onclick: () => ctx.on.copy(link) },
      icon(copied ? ICONS.check : ICONS.copy),
      h("span", { "aria-live": "polite" }, ctx.t(copied ? "copy_link_copied" : "copy_link")),
    ),
    ctx.copyLink.manual &&
      h(
        "label",
        {},
        h("span", {}, ctx.t("copy_link_manual")),
        h("input", { readonly: true, value: link, "data-testid": "copy_link_manual", onfocus: (e: Event) => (e.target as HTMLInputElement).select() }),
      ),
  )
}

const renderDeviceChoice = (ctx: ModalContext, ul: URL): HTMLElement[] => [
  h("h2", {}, ctx.t("device_choice_title")),
  h(
    "section",
    { class: "wcb-buttons", "data-testid": "device_choice" },
    h(
      "a",
      { role: "button", href: ul.toString(), target: "_blank", class: "wcb-action wcb-primary", "data-testid": "same_device_button", onclick: () => ctx.on.choose("same_device") },
      icon(ICONS.forward),
      h("span", {}, ctx.t("device_choice_same_device")),
    ),
    h(
      "button",
      { type: "button", class: "wcb-action wcb-secondary", "data-testid": "cross_device_button", onclick: () => ctx.on.choose("cross_device") },
      icon(ICONS.forward),
      h("span", {}, ctx.t("device_choice_cross_device")),
    ),
  ),
]

const renderLoading = (ctx: ModalContext): (HTMLElement | SVGElement)[] => [
  h("section", { "data-testid": "loading", class: "wcb-text" }, h("h2", {}, ctx.t("loading_title")), h("p", {}, ctx.t("loading_body"))),
  (() => {
    const el = svg([], { className: "wcb-loading-indicator", viewBox: "0 0 100 100", size: 44 })
    el.removeAttribute("fill")
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    circle.setAttribute("cx", "50")
    circle.setAttribute("cy", "50")
    circle.setAttribute("r", "45")
    el.appendChild(circle)
    return el
  })(),
]

const helpLink = (ctx: ModalContext) =>
  h(
    "a",
    { href: new URL("/help", ctx.helpBaseUrl).toString(), class: "wcb-link", "data-testid": "help" },
    h("span", {}, ctx.t("need_help")),
    icon(ICONS.external),
  )

const renderMainContent = (ctx: ModalContext): (HTMLElement | SVGElement)[] => {
  const state = ctx.state
  switch (mainView(state, ctx.installRole, ctx.clientId)) {
    case "loading":
      return renderLoading(ctx)
    case "install": {
      const role = ctx.installRole as InstallRole
      const link = onboardingLink(ctx.helpBaseUrl, ctx.clientId as string, role, true)
      return [
        h(
          "section",
          { class: "wcb-install", "data-testid": "install_section", "data-role": role },
          role === "employee" &&
            h(
              "div",
              { class: "wcb-intro", "data-testid": "install_employee_intro" },
              h("p", { class: "wcb-intro-title" }, ctx.t("help_employee_title")),
              h("p", {}, ctx.t("help_employee_description")),
            ),
          ...renderQrCode(ctx, link, ctx.t("install_title")),
          h("p", {}, ctx.t("install_body")),
        ),
      ]
    }
    case "created": {
      if (state.kind !== "created") return []
      return state.session.sessionType === "same_device"
        ? renderDeviceChoice(ctx, state.sameDeviceUl)
        : [...renderQrCode(ctx, state.crossDeviceUl), renderCopyLink(ctx, state.crossDeviceUl)]
    }
    case "in-progress":
      return [svg(ICONS.phoneArrow, { className: "wcb-status", size: 24 }), h("h2", { "data-testid": "in_progress" }, ctx.t("in_progress_title"))]
    case "confirm-stop":
      return [
        h("section", { class: "wcb-text" }, h("h2", { "data-testid": "confirm_stop" }, ctx.t("confirm_stop_title")), h("p", {}, ctx.t("confirm_stop_body"))),
        helpLink(ctx),
      ]
    case "success": {
      if (state.kind !== "success") return []
      if (state.session.sessionType === "same_device") {
        return [
          svg(ICONS.phoneCheck, { className: "wcb-status", size: 24 }),
          h("section", { class: "wcb-text", "data-testid": "success_same_device" }, h("h2", {}, ctx.t("success_title")), h("p", {}, ctx.t("success_body"))),
        ]
      }
      return [
        svg(ICONS.circleCheck, { className: "wcb-status", size: 72, viewBox: "0 0 72 72" }),
        h("section", { class: "wcb-text", "data-testid": "success_cross_device" }, h("h2", {}, ctx.t("success_title"))),
      ]
    }
    case "error": {
      if (state.kind !== "error") return []
      const texts: Record<string, [string, string]> = {
        expired: ["expired_header", "expired"],
        failed: ["failed_header", "failed"],
        cancelled: ["cancelled_header", "cancelled"],
        network: ["network_header", "network"],
      }
      const [testId, word] = texts[state.errorType]
      return [
        svg(ICONS.phoneCross, { className: "wcb-status", size: 24 }),
        h(
          "section",
          { class: "wcb-text" },
          h("h2", { "data-testid": testId }, ctx.t(`${word}_title` as Parameters<Translate>[0])),
          h("p", {}, ctx.t(`${word}_body` as Parameters<Translate>[0])),
        ),
        helpLink(ctx),
      ]
    }
  }
}

export const renderMain = (ctx: ModalContext): HTMLElement => h("main", { tabindex: "0" }, ...renderMainContent(ctx))

const storeBadge = (ctx: ModalContext, store: Store, href: string | undefined, label: string, testId: string, onClick: () => void) => {
  const storeIcon =
    store === "apple"
      ? svg(ICONS.apple, { className: "wcb-store-badge-icon", ariaHidden: true })
      : store === "google"
        ? svg(ICONS.google, { className: "wcb-store-badge-icon", ariaHidden: true })
        : svg(ICONS.download, { className: "wcb-store-badge-icon", ariaHidden: true })
  const text = h(
    "span",
    { class: "wcb-store-badge-text" },
    h("small", {}, ctx.t(`${store}_store_line1` as Parameters<Translate>[0])),
    h("strong", {}, ctx.t(`${store}_store_line2` as Parameters<Translate>[0])),
  )
  const attrs = { class: `wcb-store-badge wcb-${store}`, "aria-label": label, "data-testid": testId, onclick: onClick }
  return href
    ? h("a", { ...attrs, href, target: "_blank", rel: "noopener noreferrer" }, storeIcon, text)
    : h("button", { ...attrs, type: "button" }, storeIcon, text)
}

/** HelpSection.vue: download badges per role (NB with a registration id), or the website link. */
export const renderHelp = (ctx: ModalContext): HTMLElement => {
  const { brand, clientId, device } = ctx
  const showRoleBadges = !!brand.store && !!clientId && !ctx.issuance
  const showHolderBadge = !!brand.store && !!clientId && ctx.issuance
  const store = storeForDevice(device.isMobile, device.isAndroid)
  const badgeHref = (role: InstallRole) =>
    device.isMobile && brand.store ? storeUrl(brand.store, store, onboardingParams(clientId as string, role)) : undefined
  const onBadge = (role: InstallRole) => () => {
    if (!device.isMobile) ctx.on.install(role)
  }

  if (showRoleBadges) {
    const employeeAttrs = {
      class: "wcb-link",
      "data-testid": "download_employee_link",
      onclick: onBadge("employee"),
    }
    const employeeHref = badgeHref("employee")
    return h(
      "section",
      { class: "wcb-download", "data-testid": "download_section" },
      h(
        "div",
        { class: "wcb-options" },
        h(
          "div",
          { class: "wcb-option", "data-testid": "download_director" },
          h("p", { class: "wcb-option-title" }, ctx.t("help_director_title")),
          h("p", {}, ctx.t("help_director_description")),
          storeBadge(ctx, store, badgeHref("director"), ctx.t("help_director_link"), "download_director_badge", onBadge("director")),
        ),
      ),
      h(
        "p",
        { class: "wcb-employee" },
        employeeHref
          ? h("a", { ...employeeAttrs, href: employeeHref, target: "_blank", rel: "noopener noreferrer" }, ctx.t("help_employee_link"))
          : h("button", { ...employeeAttrs, type: "button" }, ctx.t("help_employee_link")),
      ),
    )
  }
  if (showHolderBadge) {
    return h(
      "section",
      { class: "wcb-download", "data-testid": "download_section" },
      h(
        "div",
        { class: "wcb-options" },
        h(
          "div",
          { class: "wcb-option", "data-testid": "download_holder" },
          h("p", { class: "wcb-option-title" }, ctx.t("help_issuance_title")),
          h("p", {}, ctx.t("help_issuance_description")),
          storeBadge(ctx, store, badgeHref("holder"), ctx.t("help_issuance_link"), "download_holder_badge", onBadge("holder")),
        ),
      ),
    )
  }
  return h(
    "section",
    { class: "wcb-website", "data-testid": "website_link" },
    h("p", {}, ctx.t("help_title")),
    h("p", {}, h("a", { href: ctx.helpBaseUrl.toString(), class: "wcb-link" }, icon(ICONS.external), h("span", {}, ctx.t("help_to_website")))),
  )
}

/** The credentials the registration asks for, with a link to where each can be obtained. */
export const renderCredentials = (ctx: ModalContext): HTMLElement | null => {
  if (ctx.credentials.length === 0) return null
  const nl = ctx.lang === "nl"
  return h(
    "section",
    { class: "wcb-credentials", "data-testid": "required_credentials" },
    h("h3", {}, nl ? "Benodigde Attestaties:" : "Required Credentials:"),
    ...ctx.credentials.map((c) =>
      h(
        "div",
        { class: "wcb-credential" },
        h("span", {}, nl ? c.credentialName.nl : c.credentialName.en),
        c.websiteUrl ? h("a", { href: c.websiteUrl, target: "_blank", rel: "noopener noreferrer" }, nl ? "→ Verkrijg attestatie" : "→ Get credential") : null,
      ),
    ),
  )
}

export const renderFooter = (ctx: ModalContext): HTMLElement =>
  h(
    "footer",
    {},
    ...footerActions(ctx.state, ctx.installRole).map((a) =>
      a.kind === "help"
        ? h(
            "a",
            { href: new URL("/help", ctx.helpBaseUrl).toString(), class: "wcb-action wcb-link", "data-testid": "help" },
            icon(ICONS.external),
            h("span", {}, ctx.t("need_help")),
          )
        : action(ctx, a),
    ),
  )

/** The whole dialog: overlay, dialog box, header, main, help, credentials, footer. */
export const renderModal = (ctx: ModalContext): HTMLElement => {
  const dialog = h(
    "aside",
    {
      "aria-modal": "true",
      role: "dialog",
      "aria-label": ctx.brand.name,
      class: ["wcb-modal", ...modalClassNames(ctx.state, ctx.installRole)].join(" "),
      "data-testid": "wallet_modal",
    },
    renderHeader(ctx),
    renderMain(ctx),
    showHelpSection(ctx.state, ctx.installRole) && renderHelp(ctx),
    showHelpSection(ctx.state, ctx.installRole) ? renderCredentials(ctx) : null,
    renderFooter(ctx),
  )
  return h("div", { class: ["wcb-overlay", ctx.brand.cssClass].filter(Boolean).join(" ") }, dialog)
}
