import { describe, expect, it } from "vitest"
import { bw, nb, np, up18 } from "../src/brands"
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
    expect(translations("nl", nb.translations)("wallet_button_text")).toBe("Inloggen met de ZZP Garantie app")
  })

  it("falls back to the base string for words a brand does not override", () => {
    expect(translations("en", nb.translations)("close")).toBe("Close")
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
