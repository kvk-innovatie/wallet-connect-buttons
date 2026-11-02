import type { InstallRole, ModalState } from "./session/state"
import type { Word } from "./translations"

/** Which section the dialog's main area shows. */
export type MainView = "loading" | "install" | "created" | "in-progress" | "confirm-stop" | "success" | "error"

export const mainView = (state: ModalState, installRole: InstallRole | null, clientId?: string): MainView => {
  switch (state.kind) {
    case "creating":
    case "loading":
      return "loading"
    case "created":
      return installRole && clientId ? "install" : "created"
    default:
      return state.kind
  }
}

/** Classes on the dialog element: its state, the session type of a success, and the install view. */
export const modalClassNames = (state: ModalState, installRole: InstallRole | null): string[] => {
  const classes = [`wcb-${state.kind}`]
  if (state.kind === "success") classes.push(`wcb-${state.session.sessionType}`)
  if (state.kind === "created" && installRole) classes.push("wcb-install")
  return classes
}

/** The help section (download badges or website link) sits under the created screen only. */
export const showHelpSection = (state: ModalState, installRole: InstallRole | null): boolean =>
  state.kind === "created" && !installRole

/** The header's back arrow returns from the install QR code to the created screen. */
export const showBackArrow = (state: ModalState, installRole: InstallRole | null): boolean =>
  state.kind === "created" && !!installRole

export type ActionVariant = "primary" | "secondary" | "error" | "link"

/** What a footer button does when pressed. */
export type FooterCommand = "confirmStop" | "stop" | "retry" | "installed" | "close" | "back"

export type FooterAction =
  | { kind: "help"; testId: "help" }
  | { kind: "button"; testId: string; variant: ActionVariant; word: Word; icon: string; command: FooterCommand }

/** The footer of ModalFooter.vue, as data: the buttons for a state, in order. */
export const footerActions = (state: ModalState, installRole: InstallRole | null): FooterAction[] => {
  const kind = state.kind
  const busy = kind === "creating" || kind === "loading" || kind === "in-progress"
  const actions: FooterAction[] = []

  if (busy) actions.push({ kind: "help", testId: "help" })

  if (busy || kind === "confirm-stop") {
    const confirming = kind === "confirm-stop"
    actions.push({
      kind: "button",
      testId: "cancel_button",
      variant: confirming ? "error" : "secondary",
      word: confirming ? "yes_stop" : "stop",
      icon: "cancel",
      command: confirming ? "stop" : "confirmStop",
    })
  }

  if (kind === "error") {
    actions.push({ kind: "button", testId: "retry_button", variant: "primary", word: "retry", icon: "retry", command: "retry" })
  }

  if (kind === "created" && installRole) {
    actions.push({ kind: "button", testId: "installed_button", variant: "primary", word: "install_done", icon: "check", command: "installed" })
  }

  if ((kind === "created" && !installRole) || kind === "error" || kind === "success") {
    const primary = kind === "success" && state.session.sessionType === "same_device"
    actions.push({
      kind: "button",
      testId: "close_button",
      variant: primary ? "primary" : "link",
      word: "close",
      icon: "close",
      command: kind === "created" ? "stop" : "close",
    })
  }

  if (kind === "confirm-stop") {
    actions.push({ kind: "button", testId: "back_button", variant: "link", word: "no", icon: "back", command: "back" })
  }

  return actions
}
