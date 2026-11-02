// Slim entry: no embedded fonts (about 140 KB less); the dialog uses the system font.
import { createWalletConnectButton } from "@wallet-connect/ui-vue"
import { brands, nbwalletWarning } from "./brands"

export const WalletConnectButton = createWalletConnectButton({ brands, nbwalletWarning })
export default WalletConnectButton
export { SESSION_MESSAGE_TYPE, sessionFromMessage, type DisclosedAttributesResponse, type AttributeData, type SessionOutcome } from "@wallet-connect/core"
