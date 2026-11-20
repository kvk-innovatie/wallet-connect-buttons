import { describe, expect, it } from "vitest"
import { bw, np, selectBrand, up18, type Brand } from "../src/brands"
import {
  buildIssuanceStartUrl,
  buildStartUrl,
  buildStaticUniversalLink,
  resolveHelpBaseUrl,
  resolveHost,
  resolveReturnUrl,
  usesIssuanceLane,
} from "../src/rp/hosts"

// A brand that still issues with the static links (NB Wallet Connect, in the other repository, works this way).
const staticNp: Brand = { ...np, issuanceFlow: "static" }

// The hosts the 1.x buttons hard-coded in getDefaultHost(), except issuance: on the WE BUILD lane it is part of
// wallet-connect's own API, the disclosure host. Only a brand on the static flow keeps its issuance hosts.
describe("resolveHost", () => {
  it.each([
    ["np", np, {}, "https://wallet-connect.eu"],
    ["np", np, { issuance: true }, "https://wallet-connect.eu"],
    ["np", np, { useLocalWcServer: true }, "http://localhost:5021"],
    ["np", np, { useLocalWcServer: true, issuance: true }, "http://localhost:5021"],
    ["bw", bw, {}, "https://bw.wallet-connect.eu"],
    ["bw", bw, { issuance: true }, "https://bw.wallet-connect.eu"],
    ["bw", bw, { useLocalWcServer: true }, "http://bw.localhost:5021"],
    ["bw", bw, { useLocalWcServer: true, issuance: true }, "http://bw.localhost:5021"],
    ["up18", up18, {}, "https://wallet-connect.eu"],
    ["up18", up18, { issuance: true }, "https://wallet-connect.eu"],
    ["static np", staticNp, { issuance: true }, "https://issuance.wallet-connect.eu"],
    ["static np", staticNp, { useLocalWcServer: true, issuance: true }, "http://localhost:5007"],
    ["static np", staticNp, {}, "https://wallet-connect.eu"],
  ] as const)("%s with %o -> %s", (_name, brand, flags, host) => {
    expect(resolveHost(brand, flags)).toBe(host)
  })

  it("puts NP Wallet, Business Wallet and 18up on the lane; a brand without issuanceFlow is static", () => {
    expect([np, bw, up18].map(usesIssuanceLane)).toEqual([true, true, true])
    const { issuanceFlow: _, ...withoutFlow } = np
    expect(usesIssuanceLane(withoutFlow)).toBe(false)
    expect(usesIssuanceLane(staticNp)).toBe(false)
  })
})

describe("resolveHelpBaseUrl", () => {
  it("prefers an explicit url, else the brand's", () => {
    expect(resolveHelpBaseUrl(np).toString()).toBe("https://npwallet.org/")
    expect(resolveHelpBaseUrl(bw).toString()).toBe("https://ebwallet.org/download")
    expect(resolveHelpBaseUrl(up18).toString()).toBe("https://18up.eu/nl/install/")
    expect(resolveHelpBaseUrl(bw, "https://example.com/help").toString()).toBe("https://example.com/help")
    expect(resolveHelpBaseUrl(bw, "").toString()).toBe("https://ebwallet.org/download")
  })
})

describe("urls", () => {
  it("resolves the return url against the document", () => {
    expect(resolveReturnUrl(undefined, "https://rp.example/page?x=1")).toBe("https://rp.example/page?x=1")
    expect(resolveReturnUrl("/done", "https://rp.example/page")).toBe("https://rp.example/done")
    expect(resolveReturnUrl("https://host.example/", "https://rp.example/page")).toBe("https://host.example/")
  })

  it("builds the start url for direct and proxied calls", () => {
    expect(buildStartUrl("https://wallet-connect.eu", "https://rp.example/")).toBe(
      "https://wallet-connect.eu/api/create-session?lang=en&return_url=https%3A%2F%2Frp.example%2F",
    )
    expect(buildStartUrl("", "https://rp.example/")).toBe("/api/create-session?lang=en&return_url=https%3A%2F%2Frp.example%2F")
  })

  it("builds the lane's issuance start url", () => {
    expect(buildIssuanceStartUrl("https://wallet-connect.eu", "nl")).toBe("https://wallet-connect.eu/api/issuance/sessions?lang=nl")
    expect(buildIssuanceStartUrl("https://bw.wallet-connect.eu", "en")).toBe("https://bw.wallet-connect.eu/api/issuance/sessions?lang=en")
  })

  it("builds the static issuance link per brand", () => {
    expect(buildStaticUniversalLink(np, "https://issuance.wallet-connect.eu", "nlw_1", "same_device")).toBe(
      "walletdebuginteraction://wallet.edi.rijksoverheid.nl/disclosure_based_issuance?request_uri=https%3A%2F%2Fissuance.wallet-connect.eu%2Fdisclosure%2Fnlw_1%2Frequest_uri%3Fsession_type%3Dsame_device&request_uri_method=post&client_id=x509_san_dns:issuance.wallet-connect.eu",
    )
    expect(buildStaticUniversalLink(bw, "https://bw.issuance.wallet-connect.eu", "nlw_1", "cross_device")).toMatch(
      /^businesswalletdebuginteraction:\/\/ebwallet\.org\/disclosure_based_issuance\?/,
    )
  })
})

describe("selectBrand", () => {
  const all = { default: np, business: bw, over18: up18 }
  it("has the 1.x precedence", () => {
    expect(selectBrand(all, {})).toBe(np)
    expect(selectBrand(all, { business: true })).toBe(bw)
    expect(selectBrand(all, { over18: true, business: true })).toBe(up18)
    expect(selectBrand(all, { nbwallet: true, over18: true })).toBe(up18)
  })
  it("ignores flags a package does not carry", () => {
    expect(selectBrand({ default: np }, { business: true, nbwallet: true })).toBe(np)
  })
})
