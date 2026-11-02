// Default entry: registers the custom element on import, with the RO Sans fonts embedded.
import { defineWalletConnectButton } from "@wallet-connect/ui-vanilla"
import { ensureFonts } from "@wallet-connect/core/fonts"
import { TAG_NAME, brands, nbwalletWarning } from "./brands"

export const WalletConnectButtonElement = defineWalletConnectButton(TAG_NAME, brands, { fonts: ensureFonts, nbwalletWarning })
export { TAG_NAME }
export { SESSION_MESSAGE_TYPE, sessionFromMessage } from "@wallet-connect/core"
