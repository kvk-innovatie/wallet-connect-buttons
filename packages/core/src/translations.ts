import en from "./i18n/en.json"
import nl from "./i18n/nl.json"
import { LOCAL_WORDS, type LocalWord } from "./i18n/local"
import type { Word as WalletWebWord } from "./i18n/words"

/** A word of the dialog: wallet_web's (i18n/en.json, nl.json) or this repository's own (i18n/local.ts). */
export type Word = WalletWebWord | LocalWord
export type Language = "nl" | "en"
export type Dictionary = Record<Word, string>
export type DictionaryOverrides = Partial<Dictionary>
export type Translate = (word: Word) => string

// typed through the generated word list, so the declarations never reference the JSON files
const base: Record<Language, Dictionary> = {
  en: { ...(en as Record<WalletWebWord, string>), ...LOCAL_WORDS.en },
  nl: { ...(nl as Record<WalletWebWord, string>), ...LOCAL_WORDS.nl },
}

/** `"en"` or `"nl"`; anything else (including undefined) is Dutch, as the buttons always defaulted. */
export const resolveLanguage = (lang?: string | null): Language => (lang === "en" ? "en" : "nl")

/** A translate function for `lang`, with a brand's overrides layered over the base strings. */
export const translations = (
  lang: Language,
  overrides?: Partial<Record<Language, DictionaryOverrides>>,
): Translate => {
  const words: Dictionary = { ...base[lang], ...(overrides?.[lang] ?? {}) }
  return (word) => words[word]
}
