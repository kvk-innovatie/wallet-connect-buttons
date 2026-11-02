import type { ConnectState, ModalState, SessionDriver, WalletConnectController } from "@wallet-connect/core"
import { onScopeDispose, shallowRef, type ShallowRef } from "vue"

/** The session's state as a reactive ref. */
export const useSessionState = (session: SessionDriver): ShallowRef<ModalState> => {
  const state = shallowRef(session.getState())
  const off = session.subscribe((next) => (state.value = next))
  onScopeDispose(off)
  return state
}

/** The controller's state (phase, credentials) as a reactive ref. */
export const useConnectState = (controller: WalletConnectController): ShallowRef<ConnectState> => {
  const state = shallowRef(controller.getState())
  const off = controller.subscribe((next) => (state.value = next))
  onScopeDispose(off)
  return state
}
