import { describe, expect, it } from "vitest"
import { changePercent, dailyTotals, TREND_DAYS } from "../src/lib/store/home-stats"
import { emptyDb } from "../src/lib/store/db"
import type { Db, Sale } from "../src/lib/store/types"

const TODAY = "2026-11-12"

function sale(id: string, iso: string, total: number, voided = false): Sale {
  return {
    id, no: 1000, at: iso, cashier: "c", lines: [], subtotal: total, lineDiscount: 0, billDiscount: 0, total,
    payments: [], change: 0, due: 0, customerId: null, customerName: null,
    ...(voided ? { voided: { at: iso, by: "c", reason: "ভুল" } } : {}),
  }
}
const withSales = (sales: Sale[]): Db => ({ ...emptyDb(), sales })

describe("dailyTotals", () => {
  it("সাত দিনের মোট দেয়, পুরনো থেকে আজ", () => {
    const db = withSales([sale("a", "2026-11-12T10:00:00+06:00", 500), sale("b", "2026-11-11T10:00:00+06:00", 300), sale("c", "2026-11-06T10:00:00+06:00", 100)])
    const t = dailyTotals(db, TODAY)
    expect(t).toHaveLength(TREND_DAYS)
    expect(t[TREND_DAYS - 1]).toBe(500)
    expect(t[TREND_DAYS - 2]).toBe(300)
    expect(t[0]).toBe(100)
  })
  it("বাতিল বিল ও সীমার বাইরের দিন ধরে না", () => {
    const db = withSales([sale("a", "2026-11-12T10:00:00+06:00", 500, true), sale("b", "2026-11-05T10:00:00+06:00", 900)])
    expect(dailyTotals(db, TODAY).every((n) => n === 0)).toBe(true)
  })
  it("বিল না থাকলে সব শূন্য", () => {
    expect(dailyTotals(emptyDb(), TODAY)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe("changePercent", () => {
  it("আগের মান শূন্য বা না থাকলে null", () => {
    expect(changePercent(500, 0)).toBeNull()
  })
  it("বাড়া ও কমা শতাংশ, পূর্ণসংখ্যায়", () => {
    expect(changePercent(1120, 1000)).toBe(12)
    expect(changePercent(750, 1000)).toBe(-25)
    expect(changePercent(1000, 1000)).toBe(0)
  })
})
