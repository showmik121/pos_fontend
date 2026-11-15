import { ErrorEnvelopeSchema } from "./schemas"

export const DEFAULT_API_URL = "https://gaxzkbcomeexlnzquvzf.supabase.co/functions/v1/api"
const REQUEST_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "")
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH"
  body?: unknown
  token?: string | null
  /** টেস্ট ও বিশেষ ক্ষেত্রে fetch বদলানোর জন্য */
  fetchImpl?: typeof fetch
  baseUrl?: string
}

/** API-তে অনুরোধ পাঠায়, উত্তরটা `parse` দিয়ে যাচাই করে ফেরত দেয়। ব্যর্থ হলে সবসময় ApiError ছোড়ে। */
export async function apiRequest<T>(path: string, parse: (data: unknown) => T, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, fetchImpl = fetch, baseUrl = apiBaseUrl() } = opts
  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(0, "network", "ইন্টারনেট সংযোগ নেই বা সার্ভারে পৌঁছানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন")
  } finally {
    clearTimeout(timer)
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // JSON নয়; নিচে স্ট্যাটাস দেখে ত্রুটি বানানো হবে
  }

  if (!res.ok) {
    const env = ErrorEnvelopeSchema.safeParse(data)
    if (env.success) throw new ApiError(res.status, env.data.error.code, env.data.error.message, env.data.error.details)
    throw new ApiError(res.status, "http_error", "সার্ভারে সমস্যা হয়েছে, একটু পরে আবার চেষ্টা করুন")
  }

  try {
    return parse(data)
  } catch {
    throw new ApiError(res.status, "bad_response", "সার্ভারের উত্তর বোঝা যায়নি, অ্যাপ হালনাগাদ করে দেখুন")
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন"
}
