import { describe, expect, it } from "vitest"
import { changePercent, reportRange } from "../src/lib/store/report-range"
import { daySummary, rangeSummary } from "../src/lib/store/selectors"
import type { Db } from "../src/lib/store/types"

describe("reportRange", () => {
  it("আজ ও গতকাল এক দিন; আগের সময় তার আগের দিন", () => {
    expect(reportRange("today", "2026-11-20")).toEqual({ from: "2026-11-20", to: "2026-11-20", prevFrom: "2026-11-19", prevTo: "2026-11-19" })
    expect(reportRange("yesterday", "2026-11-20")).toMatchObject({ from: "2026-11-19", to: "2026-11-19", prevFrom: "2026-11-18" })
  })
  it("৭ দিন আজসহ; আগের ৭ দিন তার আগে", () => {
    expect(reportRange("week", "2026-11-20")).toEqual({ from: "2026-11-14", to: "2026-11-20", prevFrom: "2026-11-07", prevTo: "2026-11-13" })
  })
  it("এই মাস ১ তারিখ থেকে আজ; আগের সময় সমান দৈর্ঘ্য", () => {
    expect(reportRange("month", "2026-11-20")).toEqual({ from: "2026-11-01", to: "2026-11-20", prevFrom: "2026-10-12", prevTo: "2026-10-31" })
  })
  it("নির্দিষ্ট দিন", () => {
    expect(reportRange("day", "2026-11-20", "2026-11-05")).toMatchObject({ from: "2026-11-05", to: "2026-11-05", prevFrom: "2026-11-04" })
  })
})

describe("changePercent", () => {
  it("বাড়া/কমা শতাংশ, আগের মান ০ হলে null", () => {
    expect(changePercent(150, 100)).toBe(50)
    expect(changePercent(50, 100)).toBe(-50)
    expect(changePercent(10, 0)).toBeNull()
  })
})

describe("rangeSummary", () => {
  const sale = (id: string, at: string, total: number, extra: object = {}) => ({ id, at, total, due: 0, change: 0, voided: false, payments: [{ method: "cash", amount: total }], lines: [{ allocations: [{ costPoisha: total / 2, qty: 1 }] }], ...extra })
  const db = { sales: [sale("a", "2026-11-10T12:00:00Z", 1000), sale("b", "2026-11-12T12:00:00Z", 2000), sale("c", "2026-11-12T12:30:00Z", 500, { voided: true })] } as unknown as Db
  it("সময়ের ভেতরের বিল যোগ করে, বাতিল বাদ", () => {
    expect(rangeSummary(db, "2026-11-10", "2026-11-12")).toMatchObject({ bills: 2, total: 3000, profit: 1500, cash: 3000 })
  })
  it("একদিনের হিসাব daySummary-র সমান", () => {
    expect(daySummary(db, "2026-11-12")).toEqual(rangeSummary(db, "2026-11-12", "2026-11-12"))
  })
})
