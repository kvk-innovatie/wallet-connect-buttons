// Drive the three example apps with the system Chrome and screenshot the wallet dialog.
//
//   DRIVER_DIR=<folder with node_modules/playwright-core> node .claude/skills/run/shoot.mjs <out-dir> [react|vue|vanilla ...]
//
// For each demo: screenshot the page, click the first button (the one on the local mock wallet-connect
// server), then screenshot the dialog five times 1.2 s apart (QR screen, then "follow the steps" once the
// mock advances the session). Prints the computed style of the dialog box and any console errors.
import { createRequire } from "node:module"
import path from "node:path"

const driverDir = process.env.DRIVER_DIR
if (!driverDir) throw new Error("set DRIVER_DIR to the folder where playwright-core is installed")
const { chromium } = createRequire(path.join(driverDir, "package.json"))("playwright-core")

const out = process.argv[2]
if (!out) throw new Error("usage: shoot.mjs <out-dir> [react|vue|vanilla ...]")
const all = { react: "http://localhost:5032/", vue: "http://localhost:5033/", vanilla: "http://localhost:5031/" }
const names = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(all)

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] })
for (const name of names) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto(all[name], { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/${name}-1-page.png` })
  await page.locator("button").first().click()
  for (let i = 2; i <= 6; i++) {
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/${name}-${i}-popup.png` })
  }
  // the dialog lives in a shadow root in vanilla; Playwright's locators pierce it
  const style = await page.locator(".wcb-modal").first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return { display: cs.display, backgroundColor: cs.backgroundColor, maxWidth: cs.maxWidth, borderRadius: cs.borderRadius }
  })
  console.log(name, "dialog:", JSON.stringify(style), "console errors:", errors.length ? errors : "none")
  await page.close()
}
await browser.close()
