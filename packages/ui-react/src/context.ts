import type { Brand, Device, Language, Translate } from "@wallet-connect/core"
import { createContext, useContext } from "react"

/** What every part of the dialog needs: the brand, texts, device and registration facts. */
export interface DialogContextValue {
  t: Translate
  lang: Language
  device: Device
  brand: Brand
  helpBaseUrl: URL
  clientId?: string
  issuance: boolean
}

export const DialogContext = createContext<DialogContextValue | null>(null)

export const useDialog = (): DialogContextValue => {
  const value = useContext(DialogContext)
  if (!value) throw new Error("wallet-connect dialog components must be rendered inside WalletModal")
  return value
}

export const useT = (): Translate => useDialog().t
