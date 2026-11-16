import { describe, expect, it } from "vitest"
import { computeCart, settlePayments } from "../src/lib/domain/cart"
import { addDays, daysBetween, formatDateBn, formatMonthYear, parseMonthYear } from "../src/lib/domain/dates"
import { classifyExpiry } from "../src/lib/domain/expiry"
import { allocateFifo, type FifoBatch } from "../src/lib/domain/fifo"
import { formatCount, formatTaka, parseTaka, takaInputValue } from "../src/lib/domain/money"
import { splitCartons, toBaseUnits } from "../src/lib/domain/units"

const TODAY = "2026-11-12"

describe("টাকা", () => {
  it("লেখা থেকে পয়সায় বদলায়", () => {
    expect(parseTaka("২৪০")).toBe(24000)
    expect(parseTaka("1,200.5")).toBe(120050)
    expect(parseTaka("৳ ৫০")).toBe(5000)
  })
  it("ভুল অঙ্ক বাতিল করে", () => {
    expect(parseTaka("")).toBeNull()
    expect(parseTaka("abc")).toBeNull()
    expect(parseTaka("1.234")).toBeNull()
    expect(parseTaka("-5")).toBeNull()
  })
  it("বাংলা অঙ্কে ও বাংলাদেশি কমায় দেখায়", () => {
    expect(formatTaka(1245000)).toBe("৳ ১২,৪৫০")
    expect(formatTaka(24050)).toBe("৳ ২৪০.৫০")
    expect(formatTaka(-1500)).toBe("−৳ ১৫")
    expect(formatCount(100000)).toBe("১,০০,০০০")
  })
  it("ইনপুট ঘরের মান বানায়", () => {
    expect(takaInputValue(24000)).toBe("240")
    expect(takaInputValue(24050)).toBe("240.5")
  })
})

describe("তারিখ ও মেয়াদ", () => {
  it("মাস/বছর থেকে মাসের শেষ তারিখ দেয়", () => {
    expect(parseMonthYear("06/2027")).toBe("2027-06-30")
    expect(parseMonthYear("০২/২০২৪")).toBe("2024-02-29")
    expect(parseMonthYear("13/2027")).toBeNull()
    expect(parseMonthYear("6/27")).toBeNull()
  })
  it("দিন গোনে ও বাংলায় দেখায়", () => {
    expect(daysBetween("2026-11-12", "2026-11-30")).toBe(18)
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01")
    expect(formatDateBn("2026-11-12")).toBe("১২ নভেম্বর ২০২৬")
    expect(formatMonthYear("2027-06-30")).toBe("০৬/২০২৭")
  })
  it("মেয়াদের অবস্থা ঠিক করে", () => {
    expect(classifyExpiry(null, TODAY)).toBe("none")
    expect(classifyExpiry("2026-11-12", TODAY)).toBe("expired")
    expect(classifyExpiry("2026-11-30", TODAY)).toBe("critical")
    expect(classifyExpiry("2027-01-15", TODAY)).toBe("soon")
    expect(classifyExpiry("2027-06-30", TODAY)).toBe("ok")
  })
})

describe("কার্টন", () => {
  it("পিসে বদলায়", () => {
    expect(toBaseUnits({ qty: 3, unit: "carton", packSize: 10 })).toBe(30)
    expect(toBaseUnits({ qty: 3, unit: "piece", packSize: 10 })).toBe(3)
    expect(() => toBaseUnits({ qty: 3, unit: "carton", packSize: 1 })).toThrow()
    expect(splitCartons(14, 10)).toEqual({ cartons: 1, pieces: 4 })
  })
})

describe("FIFO", () => {
  const b = (id: string, expiryDate: string | null, qty: number, receivedAt = "2026-01-01"): FifoBatch => ({ id, expiryDate, qtyRemaining: qty, receivedAt })
  it("আগে মেয়াদ শেষ হওয়া ব্যাচ আগে কাটে", () => {
    const out = allocateFifo([b("late", "2027-06-30", 10), b("early", "2027-03-31", 4)], 6, TODAY)
    expect(out).toEqual([{ batchId: "early", qty: 4 }, { batchId: "late", qty: 2 }])
  })
  it("মেয়াদোত্তীর্ণ ব্যাচ থেকে বিক্রি হয় না, মেয়াদ-না-থাকা সবার শেষে", () => {
    const out = allocateFifo([b("none", null, 5), b("dead", "2026-10-31", 50), b("ok", "2027-06-30", 2)], 4, TODAY)
    expect(out).toEqual([{ batchId: "ok", qty: 2 }, { batchId: "none", qty: 2 }])
  })
  it("স্টক কম হলে ত্রুটি দেয়", () => {
    expect(() => allocateFifo([b("a", "2027-06-30", 2)], 3, TODAY)).toThrow()
  })
})

describe("বিলের হিসাব", () => {
  it("ডিজাইনের উদাহরণ মেলে: ৪৫৫ − ১০ − ১৫ = ৪৩০", () => {
    const t = computeCart(
      [
        { unitPrice: 24000, qty: 1, discount: 1000 },
        { unitPrice: 2500, qty: 2, discount: 0 },
        { unitPrice: 5500, qty: 3, discount: 0 },
      ],
      { type: "amount", value: 1500 },
    )
    expect(t).toEqual({ subtotal: 45500, lineDiscount: 1000, billDiscount: 1500, total: 43000 })
  })
  it("শতাংশ ছাড় ছাড়ের পরের অঙ্কের উপর", () => {
    const t = computeCart([{ unitPrice: 10000, qty: 2, discount: 0 }], { type: "percent", value: 1000 })
    expect(t.billDiscount).toBe(2000)
    expect(t.total).toBe(18000)
  })
  it("বেশি ছাড় আটকায়", () => {
    expect(() => computeCart([{ unitPrice: 1000, qty: 1, discount: 2000 }])).toThrow()
    expect(() => computeCart([{ unitPrice: 1000, qty: 1, discount: 0 }], { type: "amount", value: 5000 })).toThrow()
  })
})

describe("পেমেন্ট", () => {
  it("কম দিলে বাকি হয়, কাস্টমার লাগে", () => {
    const base = { total: 43000, cash: 25000, mobile: 10000, mobileMethod: "bkash" as const }
    expect(() => settlePayments({ ...base, hasCustomer: false })).toThrow()
    const r = settlePayments({ ...base, hasCustomer: true })
    expect(r.due).toBe(8000)
    expect(r.paid).toBe(35000)
    expect(r.payments).toEqual([{ method: "cash", amount: 25000 }, { method: "bkash", amount: 10000 }])
  })
  it("বেশি নগদ দিলে ফেরত হয়; মোবাইল বেশি হলে ত্রুটি", () => {
    const r = settlePayments({ total: 43000, cash: 50000, mobile: 0, mobileMethod: "nagad", hasCustomer: false })
    expect(r.change).toBe(7000)
    expect(r.due).toBe(0)
    expect(() => settlePayments({ total: 100, cash: 0, mobile: 200, mobileMethod: "nagad", hasCustomer: true })).toThrow()
  })
})
