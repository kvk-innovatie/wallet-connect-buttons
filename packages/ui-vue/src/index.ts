import { defineComponent, h } from "vue"
import type { ButtonConfig } from "./config"
import WalletConnectButtonBase from "./components/WalletConnectButton.vue"
import { buttonProps } from "./props"

export type { ButtonConfig } from "./config"
export { buttonProps } from "./props"
export { default as WalletModal } from "./components/WalletModal.vue"
export { useSessionState, useConnectState } from "./useSession"

/** The public component of a package: the base button with that package's brands fixed. */
export const createWalletConnectButton = (config: ButtonConfig) =>
  defineComponent({
    name: "WalletConnectButton",
    inheritAttrs: false,
    props: buttonProps,
    setup(props, { attrs }) {
      return () => h(WalletConnectButtonBase, { ...props, ...attrs, config })
    },
  })
