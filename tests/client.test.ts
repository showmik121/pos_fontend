import { describe, expect, it, vi } from "vitest"
import { ApiError, apiRequest, errorMessage } from "../src/lib/api/client"

const BASE = "https://example.test/api"

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

/** ব্যর্থ হওয়া অনুরোধ থেকে ApiError ধরে ফেরত দেয়; ব্যর্থ না হলে টেস্ট ভাঙে। */
async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error("অনুরোধ ব্যর্থ হওয়ার কথা ছিল")
}

describe("apiRequest", () => {
  it("সফল উত্তর parse করে ফেরত দেয় এবং টোকেন ও বডি পাঠায়", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: "ok" }))
    const out = await apiRequest("/health", (d) => d as { status: string }, {
      baseUrl: BASE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      method: "POST",
      token: "abc",
      body: { a: 1 },
    })
    expect(out).toEqual({ status: "ok" })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/health`)
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc")
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
  })

  it("সার্ভারের ত্রুটির খাম থেকে কোড ও বাংলা বার্তা নেয়", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: { code: "invalid_credentials", message: "ফোন নম্বর বা পাসওয়ার্ড ঠিক নয়" } }),
    )
    const err = await failure(apiRequest("/v1/auth/login", (d) => d, { baseUrl: BASE, fetchImpl: fetchImpl as unknown as typeof fetch }))
    expect(err.status).toBe(401)
    expect(err.code).toBe("invalid_credentials")
    expect(errorMessage(err)).toBe("ফোন নম্বর বা পাসওয়ার্ড ঠিক নয়")
  })

  it("নেটওয়ার্ক না থাকলে network ত্রুটি দেয়", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const err = await failure(apiRequest("/health", (d) => d, { baseUrl: BASE, fetchImpl: fetchImpl as unknown as typeof fetch }))
    expect(err.status).toBe(0)
    expect(err.code).toBe("network")
  })

  it("ত্রুটির খাম ছাড়া ব্যর্থ উত্তরে সাধারণ বার্তা দেয়", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>502</html>", { status: 502 }))
    const err = await failure(apiRequest("/health", (d) => d, { baseUrl: BASE, fetchImpl: fetchImpl as unknown as typeof fetch }))
    expect(err.status).toBe(502)
    expect(err.code).toBe("http_error")
  })

  it("প্রত্যাশিত আকারে না এলে bad_response দেয়", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { unexpected: true }))
    const err = await failure(apiRequest(
      "/v1/me",
      () => {
        throw new Error("bad shape")
      },
      { baseUrl: BASE, fetchImpl: fetchImpl as unknown as typeof fetch },
    ))
    expect(err.code).toBe("bad_response")
  })

  it("অজানা ত্রুটিতে সাধারণ বার্তা দেখায়", () => {
    expect(errorMessage(new Error("x"))).toBe("কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন")
  })
})

describe("register-device স্কিমা", () => {
  it("A–Z এক অক্ষর নেয়, অন্য কিছু নয়", async () => {
    const { DeviceResponseSchema } = await import("../src/lib/api/schemas")
    expect(DeviceResponseSchema.parse({ code: "A" }).code).toBe("A")
    expect(() => DeviceResponseSchema.parse({ code: "a1" })).toThrow()
  })
})
