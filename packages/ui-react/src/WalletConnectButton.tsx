import {
  WalletConnectController,
  ensureStyles,
  selectBrand,
  type DisclosedAttributesResponse,
  type SessionDriver,
  type SessionOutcome,
} from "@wallet-connect/core"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { WalletModal } from "./components/WalletModal"
import type { ButtonConfig } from "./config"
import { useConnectState } from "./useSession"

/** The 1.x props, plus styling hooks that replace `::part()`. */
export interface WalletConnectButtonProps {
  label?: string
  /** Current name for the registration's identifier; wins over `clientId`. */
  serviceId?: string
  /** The original name for the same value, still fully supported. */
  clientId?: string
  onSuccess?: (attributes: DisclosedAttributesResponse) => void
  onFailed?: (outcome: SessionOutcome) => void
  apiKey?: string
  useLocalWcServer?: boolean
  business?: boolean
  lang?: string
  helpBaseUrl?: string
  issuance?: boolean
  over18?: boolean
  /** @deprecated in the NP/BW/18up package: use nb-wallet-connect-button-react. */
  nbwallet?: boolean
  /** Where the wallet sends the user after a same-device disclosure (iframe support). */
  returnUrl?: string
  /** Extra class names and inline style for the button element (`nl-wallet-button::part(button)` in 1.x). */
  className?: string
  style?: CSSProperties
  /** Class names for the button and its label (`::part(button)` / `::part(button-span)` in 1.x). */
  classes?: { button?: string; label?: string }
}

/** The public component of a package: the base button with that package's brands fixed. */
export const createWalletConnectButton = (config: ButtonConfig) => {
  let warned = false

  const WalletConnectButton = (props: WalletConnectButtonProps) => {
    const { label, serviceId, clientId: clientIdProp, onSuccess, onFailed, apiKey, useLocalWcServer = false, business = false, lang, helpBaseUrl, issuance = false, over18 = false, nbwallet = false, returnUrl, className, style, classes } = props
    const clientId = serviceId ?? clientIdProp

    // the callbacks may change every render; the controller reads the latest through refs
    const onSuccessRef = useRef(onSuccess)
    const onFailedRef = useRef(onFailed)
    onSuccessRef.current = onSuccess
    onFailedRef.current = onFailed

    const controller = useMemo(() => {
      const flags = { business, over18, nbwallet }
      if (nbwallet && config.nbwalletWarning && !warned) {
        warned = true
        console.warn(config.nbwalletWarning)
      }
      return new WalletConnectController({
        brand: selectBrand(config.brands, flags),
        clientId,
        apiKey,
        useLocalWcServer,
        issuance,
        lang,
        helpBaseUrl,
        returnUrl,
        label,
        fetch: config.fetch,
        onSuccess: (attributes) => onSuccessRef.current?.(attributes),
        onFailed: (outcome) => onFailedRef.current?.(outcome),
      })
    }, [clientId, apiKey, useLocalWcServer, business, over18, nbwallet, issuance, lang, helpBaseUrl, returnUrl, label])

    const connect = useConnectState(controller)
    const [session, setSession] = useState<SessionDriver | null>(null)
    const trigger = useRef<HTMLButtonElement>(null)

    useEffect(() => {
      ensureStyles(document)
      config.fonts?.(document)
    }, [])

    useEffect(() => {
      controller.mount()
      return () => controller.unmount()
    }, [controller])

    useEffect(() => () => session?.dispose(), [session])

    const open = useCallback(() => {
      setSession((current) => {
        if (current) return current
        return controller.createSession(() => {
          setSession(null)
          setTimeout(() => trigger.current?.focus(), 0)
        })
      })
    }, [controller])

    if (connect.phase.kind === "checking") {
      return (
        <div className="attributes" data-testid="checking_attributes">
          <div className="verification-card">
            <h2>Checking attributes...</h2>
            <p>Please wait while we verify your attributes.</p>
          </div>
        </div>
      )
    }
    if (connect.phase.kind === "error") {
      return (
        <div className="attributes" data-testid="attributes_error">
          <div className="verification-card">
            <h2>Error</h2>
            <p>An error occurred while verifying your attributes: {connect.phase.message}</p>
          </div>
        </div>
      )
    }

    return (
      <>
        <button
          ref={trigger}
          type="button"
          className={["wcb-button", className, classes?.button].filter(Boolean).join(" ")}
          style={style}
          data-part="button"
          data-testid="wallet_button"
          aria-hidden={session ? true : undefined}
          onClick={open}
        >
          <span className={["wcb-button__label", classes?.label].filter(Boolean).join(" ")} data-part="button-span">
            {controller.label}
          </span>
        </button>
        {session && typeof document !== "undefined" && createPortal(<WalletModal controller={controller} session={session} />, document.body)}
      </>
    )
  }
  WalletConnectButton.displayName = "WalletConnectButton"
  return WalletConnectButton
}
