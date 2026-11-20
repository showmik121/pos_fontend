import { describe, expect, it } from "vitest"
import { deviceStorageKey, loadDevice, saveDeviceCode } from "../src/lib/store/device"

function storage(opts: { failSet?: boolean; failGet?: boolean } = {}) {
  const m = new Map<string, string>()
  return {
    m,
    api: {
      getItem: (k: string) => {
        if (opts.failGet) throw new Error("SecurityError")
        return m.get(k) ?? null
      },
      setItem: (k: string, v: string) => {
        if (opts.failSet) throw new Error("QuotaExceededError")
        m.set(k, v)
      },
    },
  }
}

describe("সেভ ব্যর্থ হলেও ডিভাইস id প্রতিবার নতুন হয় না (#8)", () => {
  it("লেখা ব্যর্থ হলে একই সেশনে বারবার ডাকলেও একই id (নইলে প্রতিবার ২৬ কোডের একটি পুড়ত)", () => {
    const s = storage({ failSet: true })
    const a = loadDevice("dev-fail-set", s.api)
    const b = loadDevice("dev-fail-set", s.api)
    expect(b.id).toBe(a.id)
  })

  it("পড়া ছুঁড়লেও একই id থাকে", () => {
    const s = storage({ failGet: true, failSet: true })
    expect(loadDevice("dev-fail-get", s.api).id).toBe(loadDevice("dev-fail-get", s.api).id)
  })

  it("লেখা ব্যর্থ হলেও পাওয়া কোড (A–Z) সেশনে মনে থাকে", () => {
    const s = storage({ failSet: true })
    const a = loadDevice("dev-code", s.api)
    saveDeviceCode("dev-code", "C", s.api)
    expect(loadDevice("dev-code", s.api)).toEqual({ id: a.id, code: "C" })
  })

  it("স্টোরেজ ঠিক থাকলে সেটিই সত্য-উৎস: id সংরক্ষিত হয় ও একই থাকে", () => {
    const s = storage()
    const a = loadDevice("dev-ok", s.api)
    expect(JSON.parse(s.m.get(deviceStorageKey("dev-ok")) ?? "{}").id).toBe(a.id)
    expect(loadDevice("dev-ok", s.api).id).toBe(a.id)
  })

  it("দুই দোকানের id আলাদা", () => {
    const s = storage({ failSet: true })
    expect(loadDevice("dev-one", s.api).id).not.toBe(loadDevice("dev-two", s.api).id)
  })
})
