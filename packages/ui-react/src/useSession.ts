import type { ConnectState, ModalState, SessionDriver, WalletConnectController } from "@wallet-connect/core"
import { useCallback, useSyncExternalStore } from "react"

/** The session's state, re-rendering on every change. */
export const useSessionState = (session: SessionDriver): ModalState =>
  useSyncExternalStore(
    useCallback((onChange: () => void) => session.subscribe(onChange), [session]),
    () => session.getState(),
    () => session.getState(),
  )

/** The controller's state (phase, credentials). */
export const useConnectState = (controller: WalletConnectController): ConnectState =>
  useSyncExternalStore(
    useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]),
    () => controller.getState(),
    () => controller.getState(),
  )
