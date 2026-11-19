import { describe, expect, it } from "vitest"
import { addCustomer, addToCart, completeSale, createProduct, receiveDue, removeBatch, setCartCustomer, setLineDiscounts, stockIn, updateSettings, voidSale } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import type { Db } from "../src/lib/store/types"
import { eventsFromChange } from "../src/lib/sync/diff"
import type { SyncEvent } from "../src/lib/sync/events"
import { applyEvents } from "../src/lib/sync/replay"

/**
 * আসল প্রযোজক (অ্যাকশন + eventsFromChange) যা বানায়, রিপ্লের আকার-যাচাই তার কোনোটাই ভুল করে বাদ দেয় না।
 * বাদ পড়লে অন্য সব ডিভাইসে ওই ডেটা নীরবে হারাত।
 */

const T = (m: number) => new Date(Date.UTC(2026, 10, 12, 4, m, 0))
const uid = (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n + 9000).padStart(12, "0")}` })()

function fullFlow(): { events: SyncEvent[]; db: Db } {
  let db = emptyDb()
  const events: SyncEvent[] = []
  let minute = 0
  const step = (next: Db) => {
    const out = eventsFromChange(db, next, uid, T(++minute))
    events.push(...out.events)
    db = out.db
  }

  const made = createProduct(db, { name: "পন্ডস ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "প্রসাধনী", barcode: "890", open: false }, T(0))
  step(made.db)
  step(stockIn(db, { productId: made.product.id, qty: 40, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true, receiptId: uid() }, T(0)))
  const cust = addCustomer(db, { name: "করিম", phone: "01712345678" }, T(0))
  step(cust.db)

  // বাকি + ডিভাইস-উপসর্গ + লাইন-ছাড়সহ বিল
  let draft = setCartCustomer(addToCart(db.draft, made.product.id, 2), cust.customer.id)
  draft = setLineDiscounts(draft, { [made.product.id]: 1000 })
  const first = completeSale({ ...db, draft }, { cashier: "রুবেল", cash: 20000, mobile: 0, mobileMethod: "bkash", devicePrefix: "A" }, T(0))
  step(first.db)
  step(receiveDue(db, cust.customer.id, 5000, "রুবেল", T(0)))

  // দ্বিতীয় বিল মোবাইল ব্যাংকিংয়ে
  const second = completeSale({ ...db, draft: addToCart(db.draft, made.product.id, 1) }, { cashier: "রুবেল", cash: 0, mobile: 24000, mobileMethod: "nagad", devicePrefix: "A" }, T(0))
  step(second.db)

  step(voidSale(db, first.sale.id, { by: "মালিক", reason: "ভুল বিল" }, T(0)).db)
  step(removeBatch(db, db.batches[0]!.id, { by: "মালিক", reason: "মেয়াদ শেষ" }, T(0)))
  step(updateSettings(db, { defaultMinStock: 9 }))
  return { events, db }
}

describe("আসল প্রযোজকের সব ইভেন্ট রিপ্লেতে গৃহীত হয়", () => {
  it("পণ্য, স্টক, কাস্টমার, বাকি-বিল, আদায়, বাতিল, ব্যাচ সরানো, সেটিংস: কিছুই বাদ বা অপেক্ষায় পড়ে না", () => {
    const flow = fullFlow()
    const kinds = new Set(flow.events.map((e) => e.kind))
    for (const k of ["product_upserted", "stock_in", "customer_upserted", "sale_completed", "due_received", "sale_voided", "batch_removed", "settings_updated"]) {
      expect(kinds.has(k)).toBe(true)
    }
    const out = applyEvents(emptyDb(), flow.events)
    expect(out.ignored).toEqual([])
    expect(out.deferred).toEqual([])
    expect(out.db.sales).toHaveLength(2)
    expect(out.db.sales.filter((s) => s.voided)).toHaveLength(1)
    expect(out.db.sales[0]?.prefix).toBe("A")
    expect(out.db.removedBatches).toHaveLength(1)
    expect(out.db.settings.defaultMinStock).toBe(9)
    expect(out.db.ledger.length).toBe(flow.db.ledger.length)
  })
})

describe("খাতা-এন্ট্রি বিকৃত হলে বিলসহ পুরো ইভেন্ট বাদ (বিল বসে বাকি হারানো নয়)", () => {
  it("বৈধ বিল + অবৈধ ledger: বিল বসে না, ignored", () => {
    const flow = fullFlow()
    const sale = flow.events.find((e) => e.kind === "sale_completed" && (e.payload.ledger as unknown) != null)!
    const poisoned: SyncEvent = { ...sale, payload: { ...sale.payload, ledger: { id: 5, customerId: {} } } }
    const base = flow.events.filter((e) => e.kind === "product_upserted" || e.kind === "stock_in" || e.kind === "customer_upserted")
    const out = applyEvents(emptyDb(), [...base, poisoned])
    expect(out.ignored).toHaveLength(1)
    expect(out.db.sales).toHaveLength(0)
    expect(out.db.ledger).toHaveLength(0)
  })
})
