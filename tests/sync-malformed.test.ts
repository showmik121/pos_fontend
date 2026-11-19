import { describe, expect, it } from "vitest"
import { addCustomer, addToCart, completeSale, createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import type { Db } from "../src/lib/store/types"
import { runSync, type PulledPage, type Transport } from "../src/lib/sync/engine"
import { customerEvent, productEvent, saleEvent, stockInEvent, type SyncEvent } from "../src/lib/sync/events"
import { applyEvents } from "../src/lib/sync/replay"
import { emptySyncState, type SyncState } from "../src/lib/sync/state"

/** অন্য ডিভাইস/কর্মচারী বা নষ্ট সার্ভার থেকে আসা বিকৃত ইভেন্টে সিংক যেন থেমে না যায়, ডেটা যেন নষ্ট না হয় */

const T = (m: number) => new Date(Date.UTC(2026, 10, 12, 4, m, 0))
const uid = (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n + 5000).padStart(12, "0")}` })()
const raw = (kind: string, payload: Record<string, unknown>): SyncEvent => ({ id: uid(), kind, at: T(9).toISOString(), payload })

const POISON: Array<[string, SyncEvent]> = [
  ["বিলের লাইনে allocations নেই", raw("sale_completed", { sale: { id: "s-bad-1", lines: [{}] }, ledger: null })],
  ["বিলের allocations অ্যারে নয়", raw("sale_completed", { sale: { id: "s-bad-2", lines: [{ allocations: "x" }] }, ledger: null })],
  ["বিলের লাইন null", raw("sale_completed", { sale: { id: "s-bad-3", lines: [null] }, ledger: null })],
  ["পণ্যের নাম অবজেক্ট", raw("product_upserted", { product: { id: "p-bad-1", name: {}, barcodes: [], unit: "piece" } })],
  ["পণ্যের barcodes স্ট্রিং", raw("product_upserted", { product: { id: "p-bad-2", name: "ক", barcodes: "x", unit: "piece" } })],
  ["কাস্টমারের নাম সংখ্যা", raw("customer_upserted", { customer: { id: "c-bad-1", name: 5, phone: "", createdAt: "x" } })],
  ["বাকির পরিমাণ স্ট্রিং", raw("due_received", { entry: { id: "l-bad-1", customerId: "c", at: "x", kind: "payment", amount: "9", saleNo: null, by: "ক" } })],
  ["সরানো ব্যাচে qty স্ট্রিং", raw("batch_removed", { removed: { id: "r-bad-1", qty: "x", reason: 1 } })],
  ["সেটিংসের expiryDays স্ট্রিং", raw("settings_updated", { settings: { expiryDays: "x", defaultMinStock: "y" } })],
]

function realEvents(): { events: SyncEvent[]; db: Db } {
  const made = createProduct(emptyDb(), { name: "পন্ডস ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "890", open: false }, T(0))
  const rid = uid()
  let db = stockIn(made.db, { productId: made.product.id, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true, receiptId: rid }, T(1))
  const batch = db.batches[0]!
  const cust = addCustomer(db, { name: "করিম", phone: "" }, T(2))
  db = { ...cust.db, draft: addToCart(cust.db.draft, made.product.id, 2) }
  const sold = completeSale(db, { cashier: "রুবেল", cash: 48000, mobile: 0, mobileMethod: "bkash" }, T(3))
  return {
    db: sold.db,
    events: [
      productEvent(uid(), made.product, T(0)),
      stockInEvent(rid, batch, 30, T(1)),
      customerEvent(uid(), cust.customer, T(2)),
      saleEvent(uid(), sold.sale, null, T(3)),
    ],
  }
}

describe("বিকৃত সিংক ইভেন্ট: রিপ্লে", () => {
  it.each(POISON)("%s: ছোঁড়ে না, বাদ যায় (ignored), ডেটা বদলায় না", (_name, e) => {
    const before = emptyDb()
    const out = applyEvents(before, [e])
    expect(out.ignored).toHaveLength(1)
    expect(out.deferred).toHaveLength(0)
    expect(out.db.products).toEqual([])
    expect(out.db.customers).toEqual([])
    expect(out.db.sales).toEqual([])
    expect(out.db.ledger).toEqual([])
    expect(out.db.removedBatches ?? []).toEqual([])
    expect(out.db.settings).toEqual(before.settings)
  })

  it("একই দলে বিকৃত ইভেন্ট থাকলেও ঠিক ইভেন্টগুলো ঠিকভাবে বসে", () => {
    const real = realEvents()
    const out = applyEvents(emptyDb(), [...POISON.map(([, e]) => e), ...real.events])
    expect(out.ignored).toHaveLength(POISON.length)
    expect(out.deferred).toHaveLength(0)
    expect(out.db.products).toHaveLength(1)
    expect(out.db.sales).toHaveLength(1)
    expect(out.db.customers).toHaveLength(1)
    expect(out.db.batches[0]?.qtyRemaining).toBe(28)
  })

  it("আমাদের নিজের অ্যাকশনের বানানো আসল ইভেন্ট ভুল করে বাদ পড়ে না", () => {
    const real = realEvents()
    const out = applyEvents(emptyDb(), real.events)
    expect(out.ignored).toHaveLength(0)
    expect(out.db.products[0]).toEqual(real.db.products[0])
    expect(out.db.sales[0]).toEqual(real.db.sales[0])
    expect(out.db.customers[0]).toEqual(real.db.customers[0])
  })
})

describe("বিকৃত সিংক ইভেন্ট: runSync", () => {
  it("বিকৃত ইভেন্টে সিংক আটকায় না: কার্সর এগোয়, ঠিক ইভেন্ট বসে", async () => {
    const real = realEvents()
    let db: Db = emptyDb()
    let state: SyncState = emptySyncState()
    const page: PulledPage = { events: [...POISON.map(([, e]) => e), ...real.events], lastSeq: 42, hasMore: false }
    const transport: Transport = { push: async () => {}, pull: async () => page }
    const status = await runSync({
      io: { db: () => db, setDb: (d) => { db = d }, state: () => state, setState: (s) => { state = s } },
      transport,
      now: T(10),
    })
    expect(status).toBe("ok")
    expect(state.cursor).toBe(42)
    expect(db.products).toHaveLength(1)
    expect(db.sales).toHaveLength(1)
  })
})
