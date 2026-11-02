/** `type` of the message a host page posts into the iframe to hand over a finished session. */
export const SESSION_MESSAGE_TYPE = "wallet-connect-session"

export interface SessionParams {
  session_token: string
  nonce?: string
}

/**
 * The session token and nonce out of a host page's message, or null when the event is not such a
 * message. Only the page the wallet returns to may hand over a token, so the sender's origin must be
 * the return URL's origin.
 */
export const sessionFromMessage = (
  event: Pick<MessageEvent, "data" | "origin">,
  returnUrl: string,
): SessionParams | null => {
  const data = event.data
  if (!data || typeof data !== "object" || data.type !== SESSION_MESSAGE_TYPE) return null
  if (typeof data.session_token !== "string" || data.session_token === "") return null
  if (!returnUrl || event.origin !== new URL(returnUrl).origin) return null
  return { session_token: data.session_token, nonce: typeof data.nonce === "string" ? data.nonce : undefined }
}
