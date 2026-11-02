import { RO_SANS_BOLD, RO_SANS_REGULAR } from "./ro-sans"

const fontFaces = `@font-face {
  font-family: "RO Sans";
  font-weight: normal;
  font-style: normal;
  src: url(data:application/font-woff2;charset=utf-8;base64,${RO_SANS_REGULAR}) format('woff2');
}

@font-face {
  font-family: "RO Sans";
  font-weight: bold;
  font-style: normal;
  src: url(data:application/font-woff2;charset=utf-8;base64,${RO_SANS_BOLD}) format('woff2');
}`

/**
 * Register the RO Sans font faces on the document, once. `@font-face` does not work inside a shadow
 * root, so even the vanilla element puts them on the page. Only the default (non-slim) package entries
 * call this; the slim entries fall back to the system font.
 */
export const ensureFonts = (doc: Document = document): void => {
  const marked = doc as { __wcbFonts?: boolean }
  if (marked.__wcbFonts) return
  marked.__wcbFonts = true
  if (typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype && "adoptedStyleSheets" in doc) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(fontFaces)
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]
    return
  }
  const style = doc.createElement("style")
  style.textContent = fontFaces
  doc.head.appendChild(style)
}
