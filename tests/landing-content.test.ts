import { describe, expect, it } from "vitest"
import { FEATURES, HERO, STEPS, TRUST_POINTS } from "../src/components/landing/landing-content"

const BENGALI = /[ঀ-৿]/

describe("ল্যান্ডিং পাতার লেখা", () => {
  it("প্রতিটি ফিচারের শিরোনাম অনন্য এবং লেখা বাংলায়", () => {
    const titles = FEATURES.map((f) => f.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const f of FEATURES) {
      expect(f.title).toMatch(BENGALI)
      expect(f.body.length).toBeGreaterThan(20)
    }
  })

  it("শুরুর ধাপ ঠিক তিনটি", () => {
    expect(STEPS).toHaveLength(3)
    for (const s of STEPS) expect(s.title).toMatch(BENGALI)
  })

  it("হিরো ও আস্থার লাইন খালি নয়", () => {
    expect(HERO.title.length).toBeGreaterThan(0)
    expect(HERO.lead.length).toBeGreaterThan(0)
    expect(TRUST_POINTS.length).toBeGreaterThan(0)
  })
})
