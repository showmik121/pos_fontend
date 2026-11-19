import { describe, expect, it } from "vitest"
import { buildReport, isNoise, shouldSend, type KeyValueStorage } from "../src/lib/report/crash-report"

function mem(): KeyValueStorage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

describe("buildReport", () => {
  it("মেসেজ-স্ট্যাক নেয়, পথ থেকে query/hash কাটে, বড় সংখ্যা (ফোন/টাকা) আড়াল করে", () => {
    const err = new Error("খুঁজে পাওয়া যায়নি 01712345678 ০১৭১২৩৪৫৬৭৮")
    const r = buildReport("render", err, { path: "/dues/customer/?id=abc#x", appVersion: "abc1234" })
    expect(r.kind).toBe("render")
    expect(r.message).toBe("খুঁজে পাওয়া যায়নি # #")
    expect(r.path).toBe("/dues/customer/")
    expect(r.appVersion).toBe("abc1234")
    expect(r.stack).toContain("Error")
  })

  it("Error ছাড়া মান (স্ট্রিং, অবজেক্ট, null) থেকেও রিপোর্ট বানায় এবং ছাঁটে", () => {
    expect(buildReport("rejection", "boom", { path: "/", appVersion: "v" }).message).toBe("boom")
    expect(buildReport("window", { code: 1 }, { path: "/", appVersion: "v" }).message).toBe('{"code":1}')
    expect(buildReport("window", null, { path: "/", appVersion: "v" }).message).toBe("অজানা ত্রুটি")
    const big = buildReport("window", new Error("x".repeat(900)), { path: "/", appVersion: "v" })
    expect(big.message).toHaveLength(500)
    expect((big.stack ?? "").length).toBeLessThanOrEqual(4000)
  })
})

describe("isNoise", () => {
  it("বাইরের স্ক্রিপ্ট/এক্সটেনশন ও নিরীহ ব্রাউজার বার্তা বাদ", () => {
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.", undefined, "https://a.app")).toBe(true)
    expect(isNoise("Script error.", undefined, "https://a.app")).toBe(true)
    expect(isNoise("x", "chrome-extension://abc/content.js", "https://a.app")).toBe(true)
    expect(isNoise("x", "https://other.com/a.js", "https://a.app")).toBe(true)
  })
  it("নিজের স্ক্রিপ্ট বা ফাইলনাম ছাড়া ত্রুটি রাখে", () => {
    expect(isNoise("Cannot read x", "https://a.app/_next/static/chunk.js", "https://a.app")).toBe(false)
    expect(isNoise("Cannot read x", undefined, "https://a.app")).toBe(false)
  })
})

describe("shouldSend", () => {
  const now = 1_000
  it("একই ত্রুটি একবারই, সেশনে সর্বোচ্চ ৩টি", () => {
    const s = mem()
    expect(shouldSend("a", s, now)).toBe(true)
    expect(shouldSend("a", s, now)).toBe(false)
    expect(shouldSend("b", s, now)).toBe(true)
    expect(shouldSend("c", s, now)).toBe(true)
    expect(shouldSend("d", s, now)).toBe(false)
  })
  it("স্টোরেজ না থাকলে বা নষ্ট হলে পাঠায় না-থামিয়ে চালু থাকে (একই বারে একবার)", () => {
    expect(shouldSend("a", null, now)).toBe(true)
    const bad = { getItem: () => "{not json", setItem: () => { throw new Error("full") } }
    expect(shouldSend("a", bad, now)).toBe(true)
  })
})
