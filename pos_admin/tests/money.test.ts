import { describe, expect, it } from "vitest"
import { dhakaLocalToIso, formatBdt, parseTakaToPoisha, poishaToTakaInput } from "@/lib/money"

describe("formatBdt", () => {
  it("prints taka with grouping and two decimals from integer poisha", () => {
    expect(formatBdt(0)).toBe("৳0.00")
    expect(formatBdt(5)).toBe("৳0.05")
    expect(formatBdt(49_900)).toBe("৳499.00")
    expect(formatBdt(119_900)).toBe("৳1,199.00")
    expect(formatBdt(123_456_789)).toBe("৳1,234,567.89")
  })
})

describe("parseTakaToPoisha", () => {
  it("parses whole and fractional taka without float error", () => {
    expect(parseTakaToPoisha("499")).toBe(49_900)
    expect(parseTakaToPoisha("1,199.5")).toBe(119_950)
    expect(parseTakaToPoisha("0.07")).toBe(7)
    expect(parseTakaToPoisha("19.99")).toBe(1_999)
  })
  it("rejects junk, negatives, 3 decimals and empty", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "৫০০", "12.", ".5"]) expect(parseTakaToPoisha(bad)).toBeNull()
  })
  it("round-trips with poishaToTakaInput", () => {
    for (const p of [1, 99, 100, 49_900, 49_950, 119_901]) expect(parseTakaToPoisha(poishaToTakaInput(p))).toBe(p)
  })
})

describe("dhakaLocalToIso", () => {
  it("treats the typed time as Asia/Dhaka (UTC+6)", () => {
    expect(dhakaLocalToIso("2026-03-01T14:30")).toBe("2026-03-01T08:30:00.000Z")
  })
  it("returns null for empty or malformed input", () => {
    expect(dhakaLocalToIso("")).toBeNull()
    expect(dhakaLocalToIso("2026-13-45T99:99")).toBeNull()
  })
})
