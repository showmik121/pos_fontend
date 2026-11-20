import { describe, expect, it } from "vitest"
import { reminderText, smsHref, summarizeDues, viewDueRows } from "../src/lib/store/dues-view"
import type { DueRow } from "../src/lib/store/selectors"

const NOW = new Date("2026-11-20T10:00:00+06:00")
const row = (id: string, name: string, phone: string, balance: number, lastAt: string): DueRow => ({ customer: { id, name, phone, createdAt: lastAt }, balance, lastAt })
const rows = [
  row("a", "রহিম", "01711111111", 50000, "2026-11-19T10:00:00+06:00"),
  row("b", "করিম", "01822222222", 120000, "2026-09-01T10:00:00+06:00"),
  row("c", "আলী", "", 30000, "2026-10-01T10:00:00+06:00"),
]
const base = { query: "", filter: "all" as const, sort: "amount" as const, now: NOW }

describe("বাকির তালিকা", () => {
  it("বেশি বাকি আগে, পুরনো আগে, নামে বাছাই", () => {
    expect(viewDueRows(rows, base).map((r) => r.customer.id)).toEqual(["b", "a", "c"])
    expect(viewDueRows(rows, { ...base, sort: "oldest" }).map((r) => r.customer.id)).toEqual(["b", "c", "a"])
    expect(viewDueRows(rows, { ...base, sort: "name" }).map((r) => r.customer.id)).toEqual(["c", "b", "a"])
  })
  it("পুরনো ফিল্টার ও খোঁজা (বাংলা অঙ্কেও)", () => {
    expect(viewDueRows(rows, { ...base, filter: "old" }).map((r) => r.customer.id)).toEqual(["b", "c"])
    expect(viewDueRows(rows, { ...base, query: "০১৮২" }).map((r) => r.customer.id)).toEqual(["b"])
  })
  it("সারাংশ", () => {
    expect(summarizeDues(rows, NOW)).toEqual({ total: 200000, count: 3, oldTotal: 150000, oldCount: 2 })
  })
  it("তাগাদার লেখা ও এসএমএস লিংক", () => {
    const t = reminderText({ customerName: "রহিম", balance: 50000, storeName: "বিপণি" })
    expect(t).toContain("রহিম")
    expect(smsHref("01711111111", t).startsWith("sms:01711111111?&body=")).toBe(true)
  })
})

import { addCustomer, setPromise } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { duePromises } from "../src/lib/store/dues-view"

describe("আদায়ের প্রতিশ্রুতি", () => {
  const made = addCustomer(emptyDb(), { name: "রহিম", phone: "" }, NOW)
  const id = made.customer.id
  it("তারিখ বসে, মোছা যায়, পুরনো তারিখ ও ভুল তারিখ আটকায়", () => {
    const d = setPromise(made.db, id, "2026-11-25", "  বেতন পেয়ে  ", NOW)
    expect(d.customers[0]?.promise).toEqual({ date: "2026-11-25", note: "বেতন পেয়ে" })
    expect(setPromise(d, id, null, "", NOW).customers[0]?.promise).toBeNull()
    expect(() => setPromise(made.db, id, "2026-11-19", "", NOW)).toThrow()
    expect(() => setPromise(made.db, id, "abc", "", NOW)).toThrow()
    expect(made.db.customers[0]?.promise).toBeUndefined()
  })
  it("আজ বা পেরোনো প্রতিশ্রুতি দেরি-অনুযায়ী সাজানো, ভবিষ্যৎগুলো বাদ", () => {
    const mk = (i: string, date: string | null): DueRow => ({ ...row(i, i, "", 100, "2026-11-01T10:00:00+06:00"), customer: { id: i, name: i, phone: "", createdAt: "x", promise: date ? { date, note: "" } : null } })
    const out = duePromises([mk("a", "2026-11-20"), mk("b", "2026-11-17"), mk("c", "2026-11-22"), mk("d", null)], "2026-11-20")
    expect(out.map((p) => [p.row.customer.id, p.lateDays])).toEqual([["b", 3], ["a", 0]])
  })
})

import { balanceAfter, depositReceiptText } from "../src/lib/store/dues-view"
import type { LedgerEntry } from "../src/lib/store/types"

describe("জমার রসিদ", () => {
  const e = (id: string, kind: LedgerEntry["kind"], amount: number, at: string): LedgerEntry => ({ id, customerId: "c", at, kind, amount, saleNo: null, by: "" })
  const ledger = [e("1", "sale", 100000, "2026-11-01T10:00:00Z"), e("2", "payment", 30000, "2026-11-05T10:00:00Z"), e("3", "payment", 70000, "2026-11-10T10:00:00Z")]
  it("জমার পরের বাকি ওই এন্ট্রি পর্যন্ত ধরে", () => {
    expect(balanceAfter(ledger, "c", "2")).toBe(70000)
    expect(balanceAfter(ledger, "c", "3")).toBe(0)
  })
  it("আংশিক জমায় বাকি লেখে, পুরো শোধে শোধ লেখে", () => {
    const base = { storeName: "বিপণি", customerName: "রহিম", at: "2026-11-05T10:00:00Z", amount: 30000 }
    expect(depositReceiptText({ ...base, balanceAfter: 70000 })).toContain("এখনো বাকি")
    expect(depositReceiptText({ ...base, balanceAfter: 0 })).toContain("বাকি শোধ হয়েছে")
  })
})

import { setCreditLimit } from "../src/lib/store/actions"
import { limitStatus } from "../src/lib/store/dues-view"

describe("বাকির সীমা", () => {
  const made = addCustomer(emptyDb(), { name: "রহিম", phone: "" }, NOW)
  const id = made.customer.id
  it("সীমা বসে ও তোলা যায়, ০ বা ভুল মান আটকায়", () => {
    const d = setCreditLimit(made.db, id, 500000)
    expect(d.customers[0]?.creditLimit).toBe(500000)
    expect(setCreditLimit(d, id, null).customers[0]?.creditLimit).toBeNull()
    expect(() => setCreditLimit(made.db, id, 0)).toThrow()
    expect(() => setCreditLimit(made.db, "x", 100)).toThrow()
  })
  it("নতুন বাকি যোগ করে সীমা ছাড়ালে over", () => {
    expect(limitStatus(null, 100, 100)).toBeNull()
    expect(limitStatus(1000, 600, 400)).toEqual({ limit: 1000, after: 1000, over: false })
    expect(limitStatus(1000, 600, 401)?.over).toBe(true)
  })
})
