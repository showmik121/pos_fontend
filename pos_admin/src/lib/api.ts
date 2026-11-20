// Typed client for /v1/admin, driven by the shared contract (src/contract/admin-api.ts). The token lives in memory only (D4):
// a reload signs the operator out, and nothing sensitive is ever written to localStorage, cookies or the URL.
import type { z } from "zod"
import { adminContract, type AdminRouteId, type RequestOf, type ResponseOf } from "@/contract/admin-api"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const BASE = (process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "/api").replace(/\/+$/, "")

let token: string | null = null
let onSessionLost: (() => void) | null = null

export const tokenStore = {
  set(next: string | null): void {
    token = next
  },
  has(): boolean {
    return token !== null
  },
  /** called when the server says the session is gone (expired, idle, revoked) */
  onLost(handler: (() => void) | null): void {
    onSessionLost = handler
  },
}

export interface CallOptions<K extends AdminRouteId> {
  /** `:id` path parameter */
  id?: string
  /** `:fingerprint` path parameter (client-error triage) */
  fingerprint?: string
  /** query string (GET) or JSON body (everything else) */
  input?: Partial<RequestOf<K>> | Record<string, unknown>
  /** use this token instead of the stored one (the pre-2FA "pending" token) */
  tokenOverride?: string
  signal?: AbortSignal
}

export function buildUrl(path: string, params: { id?: string; fingerprint?: string }, query: Record<string, unknown> | null): string {
  let resolved = path
  if (params.id !== undefined) resolved = resolved.replace(":id", encodeURIComponent(params.id))
  // the server's fingerprints are 32 hex characters; anything else (".." included) never becomes a path segment
  if (params.fingerprint !== undefined && !/^[0-9a-f]{32}$/.test(params.fingerprint)) throw new Error("invalid fingerprint")
  if (params.fingerprint !== undefined) resolved = resolved.replace(":fingerprint", encodeURIComponent(params.fingerprint))
  const qs = new URLSearchParams()
  if (/:[a-z]+/i.test(resolved)) throw new Error("missing path parameter")
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  const tail = qs.toString()
  return `${BASE}/v1/admin${resolved}${tail ? `?${tail}` : ""}`
}

/** What an operator may read: a short English sentence. Never raw JSON, a stack trace or a server message we do not recognise. */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "forbidden":
        return "Your role is not allowed to do this."
      case "step_up_required":
        return "Confirm your password and 2FA code to continue."
      case "too_many_attempts": // what the server actually sends
      case "rate_limited":
        return "Too many attempts. Wait a minute and try again."
      case "not_found":
        return "That item was not found."
      case "invalid_transition":
        return "The shop is already in a state where this action does not apply. Refresh and check."
      case "invalid_credentials":
        return "Email, password or code is not correct."
      case "unauthorized":
      case "session_expired":
        return "Your session has ended. Sign in again."
      case "network":
        return "Cannot reach the server. Check your connection."
      case "bad_response":
        return "The server sent an unexpected reply. Nothing was changed on this screen; try again."
      default:
        return e.status >= 500 ? "The server had a problem. Try again in a moment." : "The request was not accepted. Check the values and try again."
    }
  }
  return "Something went wrong. Try again."
}

export async function call<K extends AdminRouteId>(route: K, opts: CallOptions<K> = {}): Promise<ResponseOf<K>> {
  const def = adminContract[route]
  const isGet = def.method === "GET"
  const url = buildUrl(def.path, { id: opts.id, fingerprint: opts.fingerprint }, isGet ? ((opts.input as Record<string, unknown> | undefined) ?? null) : null)
  const bearer = opts.tokenOverride ?? token
  const headers: Record<string, string> = { accept: "application/json" }
  if (bearer) headers.authorization = `Bearer ${bearer}`
  if (!isGet) headers["content-type"] = "application/json"

  let res: Response
  try {
    res = await fetch(url, { method: def.method, headers, body: isGet ? undefined : JSON.stringify(opts.input ?? {}), signal: opts.signal, cache: "no-store", credentials: "omit" })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw new ApiError(0, "network", "network")
  }

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const env = (json as { error?: { code?: unknown; message?: unknown } } | null)?.error
    const code = typeof env?.code === "string" ? env.code : `http_${res.status}`
    if (res.status === 401 && bearer && !opts.tokenOverride && route !== "auth.login") onSessionLost?.()
    throw new ApiError(res.status, code, typeof env?.message === "string" ? env.message : "")
  }

  const parsed = (def.response as z.ZodType).safeParse(json)
  if (!parsed.success) throw new ApiError(res.status, "bad_response", "")
  return parsed.data as ResponseOf<K>
}
