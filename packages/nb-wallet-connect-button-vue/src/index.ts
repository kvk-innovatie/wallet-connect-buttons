// Default entry: the button with the RO Sans fonts embedded (visual parity with 1.x).
import { createWalletConnectButton } from "@wallet-connect/ui-vue"
import { ensureFonts } from "@wallet-connect/core/fonts"
import { brands, nbwalletWarning } from "./brands"

export const WalletConnectButton = createWalletConnectButton({ brands, fonts: ensureFonts, nbwalletWarning })
export default WalletConnectButton
export { SESSION_MESSAGE_TYPE, sessionFromMessage, type DisclosedAttributesResponse, type AttributeData, type SessionOutcome } from "@wallet-connect/core"
