import { describe, expect, it } from "vitest"
import { createProduct, removeBatch, returnBatchToDealer, stockIn } from "../src/lib/store/actions"
import { addDealer, addDealerEntry, dealerBalance } from "../src/lib/store/dealers"
import { emptyDb } from "../src/lib/store/db"
import { NO_COMPANY, removedBatchCredit, removedBatchLoss, returnList } from "../src/lib/store/selectors"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"
import type { Db } from "../src/lib/store/types"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const TODAY = "2026-11-12"

function setup() {
  let db: Db = emptyDb()
  const made = (name: string, company: string) => {
    const r = createProduct(db, { name, unit: "piece", cartonSize: 1, costPoisha: 100, pricePoisha: 120, minStock: 0, category: "", company, barcode: null, open: true }, NOW)
    db = r.db
    return r.product.id
  }
  const napa = made("Napa", "Beximco")
  const seclo = made("Seclo", "Square")
  const plain = made("Plain", "")
  const stock = (productId: string, qty: number, expiry: string, batchNo: string) => {
    db = stockIn(db, { productId, qty, unit: "piece", batchNo, expiryDate: expiry, costPoisha: 100, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  }
  stock(napa, 50, "2026-12-31", "N1") // ~৪৯ দিন
  stock(napa, 10, "2026-10-31", "N0") // মেয়াদোত্তীর্ণ
  stock(seclo, 20, "2027-01-31", "S1") // ~৮০ দিন
  stock(plain, 5, "2026-12-15", "P1")
  stock(seclo, 99, "2028-01-31", "S2") // অনেক দূরে, তালিকায় আসবে না
  const dealer = addDealer(db, { name: "Beximco Dealer", phone: "" }, NOW)
  db = dealer.db
  return { db, dealerId: dealer.dealer.id, napa }
}

describe("ফেরতের তালিকা", () => {
  it("৯০ দিনের মধ্যের ও মেয়াদোত্তীর্ণ ব্যাচ কোম্পানি ধরে, মূল্য বেশি আগে; কোম্পানিহীন শেষে", () => {
    const { db } = setup()
    const groups = returnList(db, TODAY)
    expect(groups.map((g) => g.company)).toEqual(["Beximco", "Square", NO_COMPANY])
    expect(groups[0]?.rows).toHaveLength(2)
    expect(groups[0]?.costPoisha).toBe(60 * 100)
    expect(groups[1]?.rows.map((r) => r.batch.batchNo)).toEqual(["S1"])
  })
  it("সীমা কমালে কাছের ব্যাচই আসে", () => {
    const { db } = setup()
    const groups = returnList(db, TODAY, 30)
    expect(groups.flatMap((g) => g.rows.map((r) => r.batch.batchNo))).toEqual(["N0"])
  })
})

describe("ডিলারে ফেরত", () => {
  it("ব্যাচ সরে যায়, খাতায় ফেরত লেখা হয়, ডিলারের পাওনা ক্রেডিট পরিমাণ কমে", () => {
    const { db, dealerId, napa } = setup()
    const withDebt = addDealerEntry(db, dealerId, { kind: "purchase", amount: 10_000, date: TODAY, note: "চালান" }, "মালিক", NOW)
    const batch = withDebt.batches.find((b) => b.batchNo === "N1")!
    const out = returnBatchToDealer(withDebt, batch.id, { dealerId, creditPoisha: 4_000, by: "মালিক" }, NOW)
    expect(out.batches.some((b) => b.id === batch.id)).toBe(false)
    expect(dealerBalance(out, dealerId)).toBe(6_000)
    const log = out.removedBatches?.[0]
    expect(log).toMatchObject({ productId: napa, qty: 50, reason: "ডিলারে ফেরত", returnedToDealerId: dealerId, returnedToDealerName: "Beximco Dealer", creditPoisha: 4_000 })
    expect(removedBatchCredit(out)).toBe(4_000)
    expect(removedBatchLoss(out) - removedBatchCredit(out)).toBe(1_000)
    expect(out.dealerEntries?.at(-1)).toMatchObject({ kind: "payment", amount: 4_000, date: TODAY })
  })
  it("ক্রেডিট ০ হলে ডিলারের খাতায় কিছু বসে না", () => {
    const { db, dealerId } = setup()
    const batch = db.batches[0]!
    const out = returnBatchToDealer(db, batch.id, { dealerId, creditPoisha: 0, by: "মালিক" }, NOW)
    expect(out.dealerEntries ?? []).toHaveLength(0)
    expect(out.removedBatches?.[0]?.creditPoisha).toBe(0)
  })
  it("ভুল ডিলার, ভুল ক্রেডিট বা অচেনা ব্যাচে বাংলা বার্তাসহ ত্রুটি; ডেটা বদলায় না", () => {
    const { db, dealerId } = setup()
    const batch = db.batches[0]!
    expect(() => returnBatchToDealer(db, batch.id, { dealerId: "nope", creditPoisha: 0, by: "ম" }, NOW)).toThrow(/ডিলার বাছুন/)
    expect(() => returnBatchToDealer(db, batch.id, { dealerId, creditPoisha: -1, by: "ম" }, NOW)).toThrow(/ক্রেডিট/)
    expect(() => returnBatchToDealer(db, batch.id, { dealerId, creditPoisha: 1.5, by: "ম" }, NOW)).toThrow(/ক্রেডিট/)
    expect(() => returnBatchToDealer(db, "nope", { dealerId, creditPoisha: 0, by: "ম" }, NOW)).toThrow(/ব্যাচটি/)
    expect(db.batches).toContain(batch)
  })
  it("সাধারণ সরানোয় ফেরতের ফিল্ড থাকে না", () => {
    const { db } = setup()
    const out = removeBatch(db, db.batches[0]!.id, { by: "ম", reason: "মেয়াদ শেষ" }, NOW)
    expect(out.removedBatches?.[0]?.creditPoisha).toBeUndefined()
    expect(removedBatchCredit(out)).toBe(0)
  })
})

describe("সিংক", () => {
  it("ফেরত অন্য ডিভাইসে একই ফল দেয়: ব্যাচ সরে, ফেরতের তথ্য ও ডিলারের জমা আসে, দুবার দিলেও দ্বিগুণ হয় না", () => {
    const { db, dealerId } = setup()
    const before = db
    const batch = before.batches.find((b) => b.batchNo === "N1")!
    const after = returnBatchToDealer(before, batch.id, { dealerId, creditPoisha: 4_000, by: "মালিক" }, NOW)
    let n = 0
    const { events } = eventsFromChange(before, after, () => `ev-${++n}`, NOW)
    // অন্য ফোনে একই আগের অবস্থা
    const first = applyEvents(before, events)
    const second = applyEvents(first.db, events)
    expect(first.ignored).toHaveLength(0)
    expect(first.db.batches.some((b) => b.id === batch.id)).toBe(false)
    expect(first.db.removedBatches?.[0]).toMatchObject({ returnedToDealerName: "Beximco Dealer", creditPoisha: 4_000 })
    expect(dealerBalance(first.db, dealerId)).toBe(-4_000)
    expect(second.db.removedBatches).toHaveLength(1)
    expect(dealerBalance(second.db, dealerId)).toBe(-4_000)
  })
})
