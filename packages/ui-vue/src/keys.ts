import type { Brand, Device, Language, Translate } from "@wallet-connect/core"
import { inject, type InjectionKey } from "vue"

export const translateKey = Symbol("wcb-translate") as InjectionKey<Translate>
export const languageKey = Symbol("wcb-language") as InjectionKey<Language>
export const deviceKey = Symbol("wcb-device") as InjectionKey<Device>
export const brandKey = Symbol("wcb-brand") as InjectionKey<Brand>
export const helpBaseUrlKey = Symbol("wcb-help-base-url") as InjectionKey<URL>
export const clientIdKey = Symbol("wcb-client-id") as InjectionKey<string | undefined>
export const issuanceKey = Symbol("wcb-issuance") as InjectionKey<boolean>

export const injectStrict = <T>(key: InjectionKey<T>): T => {
  const value = inject(key)
  if (value === undefined) throw new Error(`Could not resolve ${key.description}`)
  return value
}

export const useT = (): Translate => injectStrict(translateKey)
