import {
  ICONS,
  footerActions,
  mainView,
  modalClassNames,
  showBackArrow,
  showHelpSection,
  type FooterCommand,
  type InstallRole,
  type ModalState,
  type SessionDriver,
  type SessionType,
  type WalletConnectController,
} from "@wallet-connect/core"
import { useEffect, useMemo, useRef, useState } from "react"
import { DialogContext, useDialog, useT } from "../context"
import { useConnectState, useSessionState } from "../useSession"
import { CreatedSection, InstallSection } from "./Created"
import { HelpSection, RequestedCredentials } from "./Help"
import { Icon } from "./Icon"
import { ConfirmStopSection, ErrorSection, InProgressSection, LoadingSection, SuccessSection } from "./Sections"

const ModalHeader = ({ back, onBack }: { back: boolean; onBack: () => void }) => {
  const t = useT()
  return (
    <header>
      {back && (
        <button type="button" className="wcb-back" aria-label={t("back")} data-testid="back_header_button" onClick={onBack}>
          <Icon d={ICONS.back} size={24} aria-hidden="true" />
        </button>
      )}
      <h1>{t("modal_header")}</h1>
    </header>
  )
}

const ModalMain = ({ state, installRole, onChoice }: { state: ModalState; installRole: InstallRole | null; onChoice: (sessionType: SessionType) => void }) => {
  const { clientId } = useDialog()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const handle = setTimeout(() => main.current?.focus(), 0)
    return () => clearTimeout(handle)
  }, [])
  const view = mainView(state, installRole, clientId)
  return (
    <main ref={main} tabIndex={0}>
      {view === "loading" && <LoadingSection />}
      {view === "install" && installRole && <InstallSection role={installRole} />}
      {view === "created" && state.kind === "created" && (
        <CreatedSection sameDeviceUl={state.sameDeviceUl} crossDeviceUl={state.crossDeviceUl} sessionType={state.session.sessionType} onChoice={onChoice} />
      )}
      {view === "in-progress" && <InProgressSection />}
      {view === "confirm-stop" && <ConfirmStopSection />}
      {view === "success" && state.kind === "success" && <SuccessSection sessionType={state.session.sessionType} />}
      {view === "error" && state.kind === "error" && <ErrorSection errorType={state.errorType} />}
    </main>
  )
}

const FOOTER_ICONS = { cancel: ICONS.cancel, retry: ICONS.retry, check: ICONS.check, close: ICONS.close, back: ICONS.back } as const

const ModalFooter = ({ state, installRole, onCommand }: { state: ModalState; installRole: InstallRole | null; onCommand: (command: FooterCommand) => void }) => {
  const { t, helpBaseUrl } = useDialog()
  return (
    <footer>
      {footerActions(state, installRole).map((action) =>
        action.kind === "help" ? (
          <a key="help" href={new URL("/help", helpBaseUrl).toString()} className="wcb-action wcb-link" data-testid="help">
            <Icon d={ICONS.external} />
            <span>{t("need_help")}</span>
          </a>
        ) : (
          <button key={action.testId} type="button" className={`wcb-action wcb-${action.variant}`} data-testid={action.testId} onClick={() => onCommand(action.command)}>
            <Icon d={FOOTER_ICONS[action.icon as keyof typeof FOOTER_ICONS]} />
            <span>{t(action.word)}</span>
          </button>
        ),
      )}
    </footer>
  )
}

/** One opening of the dialog: renders the session's state and owns the install-view toggle. */
export const WalletModal = ({ controller, session }: { controller: WalletConnectController; session: SessionDriver }) => {
  const state = useSessionState(session)
  const connect = useConnectState(controller)
  const [installRole, setInstallRole] = useState<InstallRole | null>(null)
  // the install view is a view on the created state only
  const role = state.kind === "created" ? installRole : null

  useEffect(() => {
    void session.start()
    void controller.loadRequestedCredentials()
  }, [session, controller])

  const context = useMemo(
    () => ({
      t: controller.t,
      lang: controller.lang,
      device: controller.device,
      brand: controller.brand,
      helpBaseUrl: controller.helpBaseUrl,
      clientId: controller.clientId || undefined,
      issuance: controller.issuance,
    }),
    [controller],
  )

  const command = (command: FooterCommand) => {
    switch (command) {
      case "confirmStop":
        return session.confirmStop()
      case "stop":
        return void session.stop()
      case "retry":
        return void session.retry()
      case "installed":
        return setInstallRole(null)
      case "close":
        return session.close()
      case "back":
        return void session.back()
    }
  }

  const help = showHelpSection(state, role)
  return (
    <DialogContext.Provider value={context}>
      <div className={["wcb-overlay", controller.brand.cssClass].filter(Boolean).join(" ")}>
        <aside aria-modal="true" role="dialog" aria-label={controller.brand.name} className={["wcb-modal", ...modalClassNames(state, role)].join(" ")} data-testid="wallet_modal">
          <ModalHeader back={showBackArrow(state, role)} onBack={() => setInstallRole(null)} />
          <ModalMain state={state} installRole={role} onChoice={(type) => void session.choose(type)} />
          {help && <HelpSection onInstall={setInstallRole} />}
          {help && <RequestedCredentials credentials={connect.credentials} />}
          <ModalFooter state={state} installRole={role} onCommand={command} />
        </aside>
      </div>
    </DialogContext.Provider>
  )
}
