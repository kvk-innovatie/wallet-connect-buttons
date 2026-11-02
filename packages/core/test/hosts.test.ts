import { describe, expect, it } from "vitest"
import { bw, nb, np, selectBrand, up18 } from "../src/brands"
import {
  buildStartUrl,
  buildStaticUniversalLink,
  resolveHelpBaseUrl,
  resolveHost,
  resolveReturnUrl,
} from "../src/rp/hosts"

// The exact hosts the 1.x buttons hard-coded in getDefaultHost().
describe("resolveHost", () => {
  it.each([
    [np, {}, "https://wallet-connect.eu"],
    [np, { issuance: true }, "https://issuance.wallet-connect.eu"],
    [np, { useLocalWcServer: true }, "http://localhost:5021"],
    [np, { useLocalWcServer: true, issuance: true }, "http://localhost:5007"],
    [bw, {}, "https://bw.wallet-connect.eu"],
    [bw, { issuance: true }, "https://bw.issuance.wallet-connect.eu"],
    [bw, { useLocalWcServer: true }, "http://bw.localhost:5021"],
    [bw, { useLocalWcServer: true, issuance: true }, "http://localhost:5017"],
    [up18, {}, "https://wallet-connect.eu"],
    [nb, {}, "https://connect.nbwallet.org"],
    [nb, { issuance: true }, "https://issuance.connect.nbwallet.org"],
    [nb, { useLocalWcServer: true }, "http://localhost:5021"],
    [nb, { useLocalWcServer: true, issuance: true }, "http://localhost:5017"],
  ])("%o with %o -> %s", (brand, flags, host) => {
    expect(resolveHost(brand, flags)).toBe(host)
  })
})

describe("resolveHelpBaseUrl", () => {
  it("prefers an explicit url, else the brand's", () => {
    expect(resolveHelpBaseUrl(np).toString()).toBe("https://npwallet.org/")
    expect(resolveHelpBaseUrl(bw).toString()).toBe("https://ebwallet.org/download")
    expect(resolveHelpBaseUrl(up18).toString()).toBe("https://18up.eu/nl/install/")
    expect(resolveHelpBaseUrl(nb).toString()).toBe("https://nbwallet.org/download")
    expect(resolveHelpBaseUrl(nb, "https://example.com/help").toString()).toBe("https://example.com/help")
    expect(resolveHelpBaseUrl(nb, "").toString()).toBe("https://nbwallet.org/download")
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

  it("builds the static issuance link per brand", () => {
    expect(buildStaticUniversalLink(np, "https://issuance.wallet-connect.eu", "nlw_1", "same_device")).toBe(
      "walletdebuginteraction://wallet.edi.rijksoverheid.nl/disclosure_based_issuance?request_uri=https%3A%2F%2Fissuance.wallet-connect.eu%2Fdisclosure%2Fnlw_1%2Frequest_uri%3Fsession_type%3Dsame_device&request_uri_method=post&client_id=x509_san_dns:issuance.wallet-connect.eu",
    )
    expect(buildStaticUniversalLink(bw, "https://bw.issuance.wallet-connect.eu", "nlw_1", "cross_device")).toMatch(
      /^businesswalletdebuginteraction:\/\/ebwallet\.org\/disclosure_based_issuance\?/,
    )
    expect(buildStaticUniversalLink(nb, "https://issuance.connect.nbwallet.org", "EH_1", "cross_device")).toMatch(
      /^https:\/\/nbwallet\.org\/deeplink\/disclosure_based_issuance\?/,
    )
  })
})

describe("selectBrand", () => {
  const all = { default: np, business: bw, over18: up18, nbwallet: nb }
  it("has the 1.x precedence", () => {
    expect(selectBrand(all, {})).toBe(np)
    expect(selectBrand(all, { business: true })).toBe(bw)
    expect(selectBrand(all, { over18: true, business: true })).toBe(up18)
    expect(selectBrand(all, { nbwallet: true, over18: true })).toBe(nb)
  })
  it("ignores flags a package does not carry", () => {
    expect(selectBrand({ default: nb }, { business: true })).toBe(nb)
  })
})
