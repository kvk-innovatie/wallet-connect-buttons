/**
 * Puts `text` on the clipboard. False when the page may not (no Clipboard API, an insecure context, or the
 * browser refused): the dialog then shows the link in a field to copy by hand.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** How long "Copied" stays on the button. */
export const COPIED_MS = 2000
