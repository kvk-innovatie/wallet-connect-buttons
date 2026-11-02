import type { SessionParams } from "./iframe"

/** The session the wallet put in the page's query string after a same-device disclosure, if any. */
export const readSessionParams = (search: string): SessionParams | null => {
  const params = new URLSearchParams(search)
  const session_token = params.get("session_token")
  if (!session_token) return null
  const nonce = params.get("nonce")
  return nonce ? { session_token, nonce } : { session_token }
}

type HistoryWindow = Pick<Window, "history" | "location">

/** Put a session in the query string (no navigation), so it is handled like a same-device return. */
export const writeSessionParams = (win: HistoryWindow, session: SessionParams): void => {
  const url = new URL(win.location.href)
  url.searchParams.set("session_token", session.session_token)
  if (session.nonce) url.searchParams.set("nonce", session.nonce)
  win.history.replaceState({}, "", url.toString())
}

/** Drop a used session from the query string so a reload does not retry it. */
export const clearSessionParams = (win: HistoryWindow): void => {
  const url = new URL(win.location.href)
  url.searchParams.delete("session_token")
  url.searchParams.delete("nonce")
  win.history.replaceState({}, "", url.toString())
}
