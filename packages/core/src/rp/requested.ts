import { defaultFetch, type Fetch } from "../session/api"
import type { Brand } from "../brands/types"
import { authHeaders } from "./disclosed"

export interface RequestedCredential {
  credentialKey: string
  credentialName: { en: string; nl: string }
  websiteUrl: string
  vct: string
}

export interface RequestedCredentialsRequest {
  host: string
  apiKey: string
  idPath: Brand["idPath"]
  clientId: string
}

export const requestedCredentialsUrl = (r: RequestedCredentialsRequest): string =>
  `${r.host}/api/${r.idPath}/${encodeURIComponent(r.clientId)}/requested-credentials`

// One fetch per client id and host for the lifetime of the page, shared by every button on it.
const cache = new Map<string, { data?: RequestedCredential[]; promise?: Promise<RequestedCredential[]> }>()

/** The credentials a registration asks for, shown under the QR code so the user knows what to collect first. */
export const fetchRequestedCredentials = async (
  r: RequestedCredentialsRequest,
  fetch: Fetch = defaultFetch,
): Promise<RequestedCredential[]> => {
  const key = `${r.clientId}-${r.host}`
  const cached = cache.get(key)
  if (cached?.data) return cached.data
  if (cached?.promise) return cached.promise

  const promise = (async () => {
    try {
      const response = await fetch(requestedCredentialsUrl(r), { headers: authHeaders(r.apiKey) })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const body = await response.json()
      const credentials: RequestedCredential[] = body?.data?.requestedCredentials ?? []
      cache.set(key, { data: credentials })
      return credentials
    } catch (e) {
      cache.delete(key)
      throw e
    }
  })()
  cache.set(key, { promise })
  return promise
}

/** Tests only. */
export const clearRequestedCredentialsCache = (): void => cache.clear()
