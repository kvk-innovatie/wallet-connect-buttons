import { describe, expect, it } from "vitest"
import { bw, np, up18 } from "../src/brands"
import { resolveLanguage, translations } from "../src/translations"

describe("translations", () => {
  it("defaults to Dutch", () => {
    expect(resolveLanguage(undefined)).toBe("nl")
    expect(resolveLanguage("de")).toBe("nl")
    expect(resolveLanguage("en")).toBe("en")
  })

  it("gives each brand its own button text and header", () => {
    expect(translations("en", np.translations)("wallet_button_text")).toBe("Login with NP Wallet")
    expect(translations("en", bw.translations)("wallet_button_text")).toBe("Login with Business Wallet")
    expect(translations("nl", up18.translations)("modal_header")).toBe("18up")
  })

  it("falls back to the base string for words a brand does not override", () => {
    expect(translations("en", up18.translations)("close")).toBe("Close")
    expect(translations("nl", bw.translations)("retry")).toBe(translations("nl")("retry"))
  })
})

import en from "../src/i18n/en.json"
import nl from "../src/i18n/nl.json"
import { WORDS } from "../src/i18n/words"

describe("word list", () => {
  it("matches the keys of both dictionaries (regenerate with scripts/sync-from-wallet-web.sh)", () => {
    expect([...WORDS]).toEqual(Object.keys(en).sort())
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort())
  })
})

import { LOCAL_WORDS } from "../src/i18n/local"
import { translations as tr } from "../src/translations"

describe("this repository's own words", () => {
  it("exist in both languages, do not clash with wallet_web's words, and translate", () => {
    expect(Object.keys(LOCAL_WORDS.nl).sort()).toEqual(Object.keys(LOCAL_WORDS.en).sort())
    for (const word of Object.keys(LOCAL_WORDS.en)) expect(WORDS as readonly string[]).not.toContain(word)
    expect(tr("en")("copy_link")).toBe("Copy link")
    expect(tr("nl")("copy_link_copied")).toBe("Gekopieerd")
  })
})
