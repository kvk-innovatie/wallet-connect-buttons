import en from "./i18n/en.json"
import nl from "./i18n/nl.json"
import type { Word } from "./i18n/words"

export type { Word } from "./i18n/words"
export type Language = "nl" | "en"
export type Dictionary = Record<Word, string>
export type DictionaryOverrides = Partial<Dictionary>
export type Translate = (word: Word) => string

// typed through the generated word list, so the declarations never reference the JSON files
const base: Record<Language, Dictionary> = { en: en as Dictionary, nl: nl as Dictionary }

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
