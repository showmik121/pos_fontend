import { describe, expect, it } from "vitest"
import { quickCashAmounts, resolveEntry } from "../src/lib/domain/pay-entry"

const taka = (n: number) => n * 100

describe("resolveEntry (একক মাধ্যম)", () => {
  it("ঘর ফাঁকা না ছুঁলে (null) পুরো মোট ক্যাশে ধরে", () => {
    const r = resolveEntry({ mode: "single", method: "cash", amount: null, cashInput: "", mobileInput: "", splitMethod: "bkash", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: taka(210), mobile: 0, mobileMethod: "bkash" })
  })

  it("বিকাশ বাছলে পুরো মোট মোবাইলে যায়, ক্যাশ ০", () => {
    const r = resolveEntry({ mode: "single", method: "bkash", amount: null, cashInput: "", mobileInput: "", splitMethod: "nagad", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: 0, mobile: taka(210), mobileMethod: "bkash" })
  })

  it("নগদ (Nagad) বাছলে মাধ্যম nagad", () => {
    const r = resolveEntry({ mode: "single", method: "nagad", amount: "100", cashInput: "", mobileInput: "", splitMethod: "bkash", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: 0, mobile: taka(100), mobileMethod: "nagad" })
  })

  it("ক্যাশে বেশি দিলে সেই পরিমাণই ধরে (ফেরত হিসাব settlePayments-এ)", () => {
    const r = resolveEntry({ mode: "single", method: "cash", amount: "500", cashInput: "", mobileInput: "", splitMethod: "bkash", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: taka(500), mobile: 0, mobileMethod: "bkash" })
  })

  it("খালি লেখা মুছলে ০ (পুরোটা বাকি)", () => {
    const r = resolveEntry({ mode: "single", method: "cash", amount: "  ", cashInput: "", mobileInput: "", splitMethod: "bkash", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: 0, mobile: 0, mobileMethod: "bkash" })
  })

  it("বাংলা অঙ্কে লেখা বোঝে", () => {
    const r = resolveEntry({ mode: "single", method: "cash", amount: "১৫০", cashInput: "", mobileInput: "", splitMethod: "bkash", total: taka(210) })
    expect(r).toMatchObject({ ok: true, cash: taka(150) })
  })

  it("ভুল সংখ্যা হলে ok=false", () => {
    const r = resolveEntry({ mode: "single", method: "cash", amount: "abc", cashInput: "", mobileInput: "", splitMethod: "bkash", total: taka(210) })
    expect(r.ok).toBe(false)
  })
})

describe("resolveEntry (ভাগ করে নেওয়া)", () => {
  it("ক্যাশ ঘর ছোঁয়া না হলে মোটের বাকি অংশ ক্যাশ", () => {
    const r = resolveEntry({ mode: "split", method: "cash", amount: null, cashInput: null, mobileInput: "60", splitMethod: "nagad", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: taka(150), mobile: taka(60), mobileMethod: "nagad" })
  })

  it("দুই ঘর নিজে লিখলে তাই", () => {
    const r = resolveEntry({ mode: "split", method: "cash", amount: null, cashInput: "100", mobileInput: "50", splitMethod: "bkash", total: taka(210) })
    expect(r).toEqual({ ok: true, cash: taka(100), mobile: taka(50), mobileMethod: "bkash" })
  })

  it("মোবাইল ঘর ভুল হলে ok=false", () => {
    const r = resolveEntry({ mode: "split", method: "cash", amount: null, cashInput: null, mobileInput: "x", splitMethod: "bkash", total: taka(210) })
    expect(r.ok).toBe(false)
  })
})

describe("quickCashAmounts", () => {
  it("২১০ টাকায় ২৫০, ৩০০, ৫০০", () => {
    expect(quickCashAmounts(taka(210))).toEqual([taka(250), taka(300), taka(500)])
  })

  it("৪৮০ টাকায় ৫০০ ও ১০০০ (পুনরাবৃত্তি নেই)", () => {
    expect(quickCashAmounts(taka(480))).toEqual([taka(500), taka(1000)])
  })

  it("ঠিক ৫০০ হলে মোটের সমান বাদ, পরেরগুলো", () => {
    expect(quickCashAmounts(taka(500))).toEqual([taka(1000)])
  })

  it("মোট ০ হলে খালি", () => {
    expect(quickCashAmounts(0)).toEqual([])
  })

  it("পয়সাসহ মোটে (২১০.৫০) পরের পূর্ণ অঙ্কে", () => {
    expect(quickCashAmounts(21050)).toEqual([taka(250), taka(300), taka(500)])
  })
})
