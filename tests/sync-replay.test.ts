import { describe, expect, it } from "vitest"
import { addCustomer, addToCart, completeSale, createProduct, receiveDue, removeBatch, setCartCustomer, stockIn, updateSettings, updateProduct, voidSale } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { customerBalance, totalStock } from "../src/lib/store/selectors"
import type { Db } from "../src/lib/store/types"
import { applyEvents, validateEvent } from "../src/lib/sync/replay"
import { batchRemovedEvent, customerEvent, dueEvent, productEvent, saleEvent, settingsEvent, stockInEvent, voidEvent } from "../src/lib/sync/events"
import type { SyncEvent } from "../src/lib/sync/events"

const T = (m: number) => new Date(Date.UTC(2026, 10, 12, 4, m, 0))
const uid = (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` })()

/** ডিভাইস A: পণ্য + স্টক + বিক্রি + বাকি-বিক্রি + বাতিল */
function deviceA() {
  const events: SyncEvent[] = []
  const made = createProduct(emptyDb(), { name: "পন্ডস ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "890", open: false }, T(0))
  let db = made.db
  events.push(productEvent(uid(), made.product, T(0)))
  const rid = uid()
  db = stockIn(db, { productId: made.product.id, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true, receiptId: rid }, T(1))
  const batch = db.batches[0]!
  events.push(stockInEvent(rid, batch, 30, T(1)))
  const cust = addCustomer(db, { name: "করিম", phone: "" }, T(2))
  db = cust.db
  events.push(customerEvent(uid(), cust.customer, T(2)))
  db = { ...db, draft: setCartCustomer(addToCart(db.draft, made.product.id, 4), cust.customer.id) }
  const sold = completeSale(db, { cashier: "রুবেল", cash: 20000, mobile: 0, mobileMethod: "bkash" }, T(3))
  db = sold.db
  const saleLedger = db.ledger.find((l) => l.kind === "sale") ?? null
  events.push(saleEvent(uid(), sold.sale, saleLedger, T(3)))
  return { db, events, product: made.product, batch, sale: sold.sale, customer: cust.customer }
}

const norm = (db: Db) => ({
  products: [...db.products].sort((a, b) => a.id.localeCompare(b.id)),
  batches: [...db.batches].sort((a, b) => a.id.localeCompare(b.id)).map(({ rcpt: _r, ...b }) => b),
  customers: db.customers,
  sales: db.sales,
  ledger: [...db.ledger].sort((a, b) => a.id.localeCompare(b.id)),
  settings: db.settings,
  removed: db.removedBatches ?? [],
})

describe("সিংক রিপ্লে", () => {
  it("খালি ডিভাইসে ইভেন্ট চালালে মূল ডিভাইসের অবস্থা তৈরি হয়", () => {
    const a = deviceA()
    const r = applyEvents(emptyDb(), a.events)
    expect(r.deferred).toHaveLength(0)
    expect(norm(r.db)).toEqual(norm(a.db))
    expect(totalStock(r.db, a.product.id)).toBe(26)
  })

  it("একই ইভেন্ট দুবার চালালে কিছু বদলায় না (idempotent)", () => {
    const a = deviceA()
    const once = applyEvents(emptyDb(), a.events).db
    const twice = applyEvents(once, a.events).db
    expect(norm(twice)).toEqual(norm(once))
    expect(totalStock(twice, a.product.id)).toBe(26)
  })

  it("যেকোনো ক্রমে এলে একই ফল (বিক্রি স্টক-জমার আগে এলে অপেক্ষায় থাকে)", () => {
    const a = deviceA()
    const forward = applyEvents(emptyDb(), a.events).db
    const reversed = applyEvents(emptyDb(), [...a.events].reverse()).db
    expect(norm(reversed)).toEqual(norm(forward))
    // এক এক করে উল্টো ক্রমে দিলেও
    let db = emptyDb()
    let pending: SyncEvent[] = []
    for (const e of [...a.events].reverse()) {
      const r = applyEvents(db, [...pending, e])
      db = r.db
      pending = r.deferred
    }
    expect(pending).toHaveLength(0)
    expect(norm(db)).toEqual(norm(forward))
  })

  it("বিল বাতিল: স্টক ফেরে, বাকি কমে, বাতিল বিল আবার চালালেও একবারই", () => {
    const a = deviceA()
    const v = voidSale(a.db, a.sale.id, { by: "মালিক", reason: "ভুল বিল" }, T(5))
    const ledgerVoid = v.db.ledger.find((l) => l.kind === "void") ?? null
    const ev = voidEvent(uid(), a.sale.id, { at: T(5).toISOString(), by: "মালিক", reason: "ভুল বিল" }, ledgerVoid)
    const all = [...a.events, ev]
    const r1 = applyEvents(emptyDb(), all)
    const r2 = applyEvents(r1.db, all)
    expect(totalStock(r1.db, a.product.id)).toBe(30)
    expect(r1.db.sales[0]?.voided?.by).toBe("মালিক")
    expect(customerBalance(r1.db, a.customer.id)).toBe(customerBalance(v.db, a.customer.id))
    expect(norm(r2.db)).toEqual(norm(r1.db))
  })

  it("বাতিল ইভেন্ট বিলের আগে এলে অপেক্ষায় থাকে, পরে প্রয়োগ হয়", () => {
    const a = deviceA()
    const ev = voidEvent(uid(), a.sale.id, { at: T(5).toISOString(), by: "মালিক", reason: "ভুল" }, null)
    const first = applyEvents(emptyDb(), [ev])
    expect(first.deferred).toEqual([ev])
    const second = applyEvents(applyEvents(first.db, a.events).db, first.deferred)
    expect(second.db.sales[0]?.voided?.reason).toBe("ভুল")
  })

  it("বাকি আদায় আইডি ধরে একবারই ধরা হয়", () => {
    const a = deviceA()
    const paid = receiveDue(a.db, a.customer.id, 3000, "রুবেল", T(6))
    const entry = paid.ledger.find((l) => l.kind === "payment")!
    const all = [...a.events, dueEvent(uid(), entry, T(6))]
    const r = applyEvents(applyEvents(emptyDb(), all).db, all)
    expect(customerBalance(r.db, a.customer.id)).toBe(customerBalance(paid, a.customer.id))
  })

  it("পণ্য আপডেটে শেষ-বদল জেতে, ক্রম যাই হোক", () => {
    const a = deviceA()
    const early = updateProduct(a.db, a.product.id, { name: "পন্ডস ক্রিম ৫০গ্রা", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 25000, minStock: 5, category: "" }) .products[0]!
    const late = { ...early, name: "পন্ডস ক্রিম ১০০গ্রা", pricePoisha: 26000 }
    const e1 = productEvent(uid(), early, T(10))
    const e2 = productEvent(uid(), late, T(11))
    const ab = applyEvents(applyEvents(emptyDb(), a.events).db, [e1, e2]).db
    const ba = applyEvents(applyEvents(emptyDb(), a.events).db, [e2, e1]).db
    expect(ab.products[0]?.name).toBe("পন্ডস ক্রিম ১০০গ্রা")
    expect(ba.products[0]?.pricePoisha).toBe(26000)
  })

  it("সরানো ব্যাচ পরে আসা স্টক-জমায় ফিরে আসে না, ক্ষতির খাতা থাকে", () => {
    const a = deviceA()
    const removed = removeBatch(a.db, a.batch.id, { by: "মালিক", reason: "মেয়াদ শেষ" }, T(7))
    const rb = removed.removedBatches![0]!
    const rem = batchRemovedEvent(uid(), rb)
    const stockEv = a.events.find((e) => e.kind === "stock_in")!
    const r = applyEvents(emptyDb(), [rem, ...a.events.filter((e) => e !== stockEv), stockEv])
    expect(r.db.batches).toHaveLength(0)
    expect(r.db.removedBatches).toHaveLength(1)
    expect(r.deferred).toHaveLength(0)
  })

  it("সেটিংস: শেষ-বদল জেতে", () => {
    const s1 = settingsEvent(uid(), updateSettings(emptyDb(), { defaultMinStock: 3 }).settings, T(1))
    const s2 = settingsEvent(uid(), updateSettings(emptyDb(), { defaultMinStock: 9 }).settings, T(2))
    expect(applyEvents(emptyDb(), [s2, s1]).db.settings.defaultMinStock).toBe(9)
  })

  it("অচেনা ধরনের ইভেন্ট উপেক্ষা হয়, ডেটা নষ্ট হয় না", () => {
    const e: SyncEvent = { id: uid(), kind: "future_thing", at: T(1).toISOString(), payload: { x: 1 } }
    const r = applyEvents(emptyDb(), [e])
    expect(r.ignored).toEqual([e])
    expect(norm(r.db)).toEqual(norm(emptyDb()))
  })

  it("পুরনো db ইনপুট বদলায় না", () => {
    const a = deviceA()
    const base = emptyDb()
    const snap = JSON.stringify(base)
    applyEvents(base, a.events)
    expect(JSON.stringify(base)).toBe(snap)
  })
})

describe("validateEvent", () => {
  const ok = { id: "00000000-0000-4000-8000-000000000001", kind: "sale_completed", at: "2026-11-12T04:00:00.000Z", payload: {} }
  it("ঠিক ইভেন্ট নেয়", () => expect(validateEvent(ok)).toEqual(ok))
  it("খারাপ আইডি/ধরন/সময়/পেলোড ফেরায় null", () => {
    expect(validateEvent({ ...ok, id: "x" })).toBeNull()
    expect(validateEvent({ ...ok, kind: "Bad Kind" })).toBeNull()
    expect(validateEvent({ ...ok, at: "yesterday" })).toBeNull()
    expect(validateEvent({ ...ok, payload: [] })).toBeNull()
    expect(validateEvent({ ...ok, payload: { big: "x".repeat(40000) } })).toBeNull()
    expect(validateEvent(null)).toBeNull()
  })
})
