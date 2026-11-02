// Slim entry: registers the custom element on import, without the embedded fonts (about 140 KB less).
import { defineWalletConnectButton } from "@wallet-connect/ui-vanilla"
import { TAG_NAME, brands, nbwalletWarning } from "./brands"

export const WalletConnectButtonElement = defineWalletConnectButton(TAG_NAME, brands, { nbwalletWarning })
export { TAG_NAME }
export { SESSION_MESSAGE_TYPE, sessionFromMessage } from "@wallet-connect/core"
