import { describe, expect, it } from "vitest"
import { emptyDb, newId } from "../src/lib/store/db"
import {
  activeDealers,
  addDealer,
  addDealerEntry,
  dealerBalance,
  dealerEntries,
  dealerRows,
  dealerStatus,
  payableSummary,
  removeDealer,
  removeDealerEntry,
  runningBalances,
  updateDealer,
  updateDealerEntry,
} from "../src/lib/store/dealers"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"
import type { Db } from "../src/lib/store/types"

const NOW = new Date("2026-11-20T10:00:00+06:00")
const TODAY = "2026-11-20"

function withDealer(name = "রহমান ট্রেডার্স", phone = "") {
  const r = addDealer(emptyDb(), { name, phone }, NOW)
  return { db: r.db, id: r.dealer.id }
}

const buy = (db: Db, id: string, amount: number, date: string, dueDate?: string, note = "") =>
  addDealerEntry(db, id, { kind: "purchase", amount, date, ...(dueDate ? { dueDate } : {}), note }, "মালিক", NOW)
const pay = (db: Db, id: string, amount: number, date: string) => addDealerEntry(db, id, { kind: "payment", amount, date, note: "" }, "মালিক", NOW)

describe("ডিলার", () => {
  it("নাম বাধ্যতামূলক, একই নাম ও ভুল ফোন আটকায়, ফোন ইংরেজি অঙ্কে 01XXXXXXXXX হয়ে সংরক্ষিত হয়", () => {
    const { db } = withDealer()
    expect(() => addDealer(db, { name: "  ", phone: "" }, NOW)).toThrow()
    expect(() => addDealer(db, { name: "রহমান ট্রেডার্স", phone: "" }, NOW)).toThrow()
    expect(() => addDealer(db, { name: "করিম", phone: "123" }, NOW)).toThrow()
    const ok = addDealer(db, { name: "করিম", phone: "০১৭১২-৩৪৫৬৭৮" }, NOW)
    expect(ok.dealer.phone).toBe("01712345678")
    expect(activeDealers(ok.db)).toHaveLength(2)
  })

  it("তথ্য বদলানো যায়, অন্যের নাম নিলে আটকায়", () => {
    const a = withDealer("আলফা")
    const b = addDealer(a.db, { name: "বিটা", phone: "" }, NOW)
    expect(() => updateDealer(b.db, b.dealer.id, { name: "আলফা", phone: "" })).toThrow()
    const d = updateDealer(b.db, b.dealer.id, { name: "বিটা লিমিটেড", phone: "01911111111" })
    expect(activeDealers(d).find((x) => x.id === b.dealer.id)?.name).toBe("বিটা লিমিটেড")
  })
})

describe("ডিলারের খাতা", () => {
  it("মাল নিলে পাওনা বাড়ে, টাকা দিলে কমে; অগ্রিম ঋণাত্মক", () => {
    const { db, id } = withDealer()
    let d = buy(db, id, 500000, "2026-11-01")
    d = pay(d, id, 200000, "2026-11-05")
    expect(dealerBalance(d, id)).toBe(300000)
    d = pay(d, id, 400000, "2026-11-06")
    expect(dealerBalance(d, id)).toBe(-100000)
  })

  it("ভুল মান আটকায়: শূন্য টাকা, ভবিষ্যতের তারিখ, শোধ-তারিখ আগে বা payment-এ, অজানা ডিলার", () => {
    const { db, id } = withDealer()
    expect(() => buy(db, id, 0, TODAY)).toThrow()
    expect(() => buy(db, id, 100, "2026-11-21")).toThrow()
    expect(() => buy(db, id, 100, "2026-11-10", "2026-11-09")).toThrow()
    expect(() => addDealerEntry(db, id, { kind: "payment", amount: 100, date: TODAY, dueDate: "2026-12-01", note: "" }, "মালিক", NOW)).toThrow()
    expect(() => buy(db, "nope", 100, TODAY)).toThrow()
  })

  it("লেনদেন বদল ও মোছা; payment-এ গেলে শোধ-তারিখ বাদ", () => {
    const { db, id } = withDealer()
    const d1 = buy(db, id, 100000, "2026-11-01", "2026-11-30", "চালান ১")
    const entry = dealerEntries(d1, id)[0]!
    expect(entry.dueDate).toBe("2026-11-30")
    const d2 = updateDealerEntry(d1, entry.id, { kind: "payment", amount: 50000, date: "2026-11-02", dueDate: "", note: "" }, NOW)
    const changed = dealerEntries(d2, id)[0]!
    expect(changed.kind).toBe("payment")
    expect(changed.dueDate).toBeUndefined()
    const d3 = removeDealerEntry(d2, entry.id)
    expect(dealerEntries(d3, id)).toHaveLength(0)
    expect(() => removeDealerEntry(d3, entry.id)).toThrow()
  })

  it("হিসাব না মেটা পর্যন্ত ডিলার মোছা যায় না, মিটলে যায়", () => {
    const { db, id } = withDealer()
    let d = buy(db, id, 1000, "2026-11-01")
    expect(() => removeDealer(d, id)).toThrow()
    d = pay(d, id, 1000, "2026-11-02")
    expect(activeDealers(removeDealer(d, id))).toHaveLength(0)
  })

  it("চলতি পাওনা পুরনো থেকে নতুন ক্রমে হিসাব হয়", () => {
    const { db, id } = withDealer()
    let d = buy(db, id, 1000, "2026-11-01")
    d = pay(d, id, 400, "2026-11-02")
    d = buy(d, id, 200, "2026-11-03")
    const list = dealerEntries(d, id)
    const run = runningBalances(list)
    expect(list.map((x) => run.get(x.id))).toEqual([1000, 600, 800])
  })
})

describe("শোধের সময় ও সারাংশ", () => {
  it("টাকা সবচেয়ে পুরনো মালের বিপরীতে ধরা হয়, তাই পুরনোটি মিটলে পরের তারিখ আসে", () => {
    const { db, id } = withDealer()
    let d = buy(db, id, 1000, "2026-10-01", "2026-10-15")
    d = buy(d, id, 500, "2026-11-01", "2026-12-01")
    expect(dealerStatus(d, id, TODAY)).toMatchObject({ balance: 1500, nextDue: "2026-10-15", overdue: true })
    d = pay(d, id, 1000, "2026-11-10")
    expect(dealerStatus(d, id, TODAY)).toMatchObject({ balance: 500, nextDue: "2026-12-01", overdue: false })
    d = pay(d, id, 500, "2026-11-11")
    expect(dealerStatus(d, id, TODAY)).toMatchObject({ balance: 0, nextDue: null, overdue: false })
  })

  it("শোধের দিনেই মেয়াদ পেরোনো ধরা হয় না; তারিখ না দিলে কখনো মেয়াদ-পেরোনো নয়", () => {
    const { db, id } = withDealer()
    expect(dealerStatus(buy(db, id, 100, "2026-11-01", TODAY), id, TODAY).overdue).toBe(false)
    expect(dealerStatus(buy(db, id, 100, "2026-01-01"), id, TODAY).overdue).toBe(false)
  })

  it("সারাংশে অগ্রিম ধরা হয় না; মেয়াদ-পেরোনো আগে সাজানো", () => {
    const a = withDealer("আলফা")
    const b = addDealer(a.db, { name: "বিটা", phone: "" }, NOW)
    const c = addDealer(b.db, { name: "গামা", phone: "" }, NOW)
    let d = buy(c.db, a.id, 1000, "2026-11-01", "2026-12-01")
    d = buy(d, b.dealer.id, 3000, "2026-10-01", "2026-10-20")
    d = pay(d, c.dealer.id, 500, "2026-11-01")
    const rows = dealerRows(d, TODAY)
    expect(rows.map((r) => r.dealer.name)).toEqual(["বিটা", "আলফা", "গামা"])
    expect(payableSummary(rows)).toEqual({ total: 4000, count: 2, overdueCount: 1, overdueTotal: 3000 })
  })
})

describe("সিংক", () => {
  it("ডিলার ও লেনদেন ইভেন্ট হয়ে অন্য ফোনে একই হিসাব দেয়, মোছাও যায়", () => {
    const before = emptyDb()
    const r = addDealer(before, { name: "রহমান", phone: "" }, NOW)
    let after = buy(r.db, r.dealer.id, 700000, "2026-11-01", "2026-11-30")
    after = pay(after, r.dealer.id, 200000, "2026-11-05")
    const out = eventsFromChange(before, after, newId, NOW)
    expect(out.events.map((e) => e.kind).sort()).toEqual(["dealer_entry_upserted", "dealer_entry_upserted", "dealer_upserted"])
    const other = applyEvents(emptyDb(), out.events).db
    expect(dealerBalance(other, r.dealer.id)).toBe(500000)
    expect(applyEvents(other, out.events).db).toEqual(other)

    const entry = dealerEntries(other, r.dealer.id)[0]!
    const gone = removeDealerEntry(out.db, entry.id)
    const del = eventsFromChange(out.db, gone, newId, new Date("2026-11-20T12:00:00+06:00"))
    expect(dealerBalance(applyEvents(other, del.events).db, r.dealer.id)).toBe(dealerBalance(gone, r.dealer.id))
  })

  it("দুই ফোনের আলাদা এন্ট্রি যোগ হয়; বিকৃত ইভেন্ট বাদ যায়", () => {
    const r = addDealer(emptyDb(), { name: "রহমান", phone: "" }, NOW)
    const base = eventsFromChange(emptyDb(), r.db, newId, NOW)
    const phoneA = applyEvents(emptyDb(), base.events).db
    const phoneB = applyEvents(emptyDb(), base.events).db
    const a = eventsFromChange(phoneA, buy(phoneA, r.dealer.id, 1000, "2026-11-01"), newId, NOW)
    const b = eventsFromChange(phoneB, buy(phoneB, r.dealer.id, 2500, "2026-11-02"), newId, NOW)
    const merged = applyEvents(phoneA, [...a.events, ...b.events]).db
    expect(dealerBalance(merged, r.dealer.id)).toBe(3500)

    const bad = { id: newId(), kind: "dealer_entry_upserted", at: NOW.toISOString(), payload: { entry: { id: "x", dealerId: r.dealer.id, kind: "purchase", amount: -5 } } }
    const res = applyEvents(merged, [bad])
    expect(res.ignored).toHaveLength(1)
    expect(dealerBalance(res.db, r.dealer.id)).toBe(3500)
  })
})
