import css from "./wallet.css?inline"

export const STYLE_ID = "wcb-styles"

/** The dialog stylesheet as one string. */
export const walletStyles: string = css

/**
 * Put the dialog stylesheet into a document or shadow root once. Uses adopted stylesheets where
 * available and falls back to a `<style>` element.
 */
export const ensureStyles = (root: Document | ShadowRoot): void => {
  const marker = (root as { __wcbStyles?: boolean }).__wcbStyles
  if (marker) return
  ;(root as { __wcbStyles?: boolean }).__wcbStyles = true

  if ("adoptedStyleSheets" in root && typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    return
  }
  const style = (root instanceof Document ? root : root.ownerDocument).createElement("style")
  style.id = STYLE_ID
  style.textContent = css
  ;(root instanceof Document ? root.head : root).appendChild(style)
}
