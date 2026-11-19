import { describe, expect, it } from "vitest"
import { createProduct, removeBatch, stockIn } from "../src/lib/store/actions"
import { buildBackup, parseBackup } from "../src/lib/store/backup"
import { emptyDb } from "../src/lib/store/db"
import { removedBatchLog, removedBatchLoss, totalStock } from "../src/lib/store/selectors"
import type { Db } from "../src/lib/store/types"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const LATER = new Date("2026-11-13T09:00:00+06:00")

function setup(): { db: Db; productId: string; batchId: string } {
  const made = createProduct(emptyDb(), { name: "পন্ডস ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "890", open: false }, NOW)
  const db = stockIn(made.db, { productId: made.product.id, qty: 12, unit: "piece", batchNo: "B7", expiryDate: "2026-10-31", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  return { db, productId: made.product.id, batchId: db.batches[0]?.id ?? "" }
}

describe("ব্যাচ সরানো: হিসাবের খাতা", () => {
  it("ব্যাচ সরলে স্টক কমে এবং কে, কখন, কেন, কত পিস, কত টাকার ক্ষতি তা লেখা থাকে", () => {
    const { db, productId, batchId } = setup()
    const out = removeBatch(db, batchId, { by: "রুবেল", reason: "মেয়াদ শেষ" }, LATER)
    expect(totalStock(out, productId)).toBe(0)
    expect(out.removedBatches).toHaveLength(1)
    expect(out.removedBatches?.[0]).toMatchObject({
      productId,
      productName: "পন্ডস ক্রিম",
      batchNo: "B7",
      expiryDate: "2026-10-31",
      qty: 12,
      costPoisha: 20000,
      by: "রুবেল",
      reason: "মেয়াদ শেষ",
      at: LATER.toISOString(),
    })
  })
  it("আগের Db-তে লগ না থাকলেও চলে, পুরনো Db বদলায় না", () => {
    const { db, batchId } = setup()
    expect(db.removedBatches).toBeUndefined()
    const out = removeBatch(db, batchId, { by: "মালিক", reason: "নষ্ট" }, LATER)
    expect(db.batches).toHaveLength(1)
    expect(db.removedBatches).toBeUndefined()
    expect(out).not.toBe(db)
  })
  it("কারণ ফাঁকা হলে ত্রুটি, ব্যাচ থাকে", () => {
    const { db, batchId } = setup()
    expect(() => removeBatch(db, batchId, { by: "মালিক", reason: "  " }, LATER)).toThrow("কারণ")
  })
  it("অচেনা ব্যাচ আইডিতে কিছু বদলায় না, লগও হয় না", () => {
    const { db } = setup()
    const out = removeBatch(db, "nope", { by: "মালিক", reason: "নষ্ট" }, LATER)
    expect(out).toBe(db)
  })
  it("লগ নতুন আগে সাজানো, ক্ষতির মোট = পিস × কেনা দাম", () => {
    const { db, productId, batchId } = setup()
    const first = removeBatch(db, batchId, { by: "মালিক", reason: "মেয়াদ শেষ" }, NOW)
    const again = stockIn(first, { productId, qty: 5, unit: "piece", batchNo: "B8", expiryDate: "2026-12-31", costPoisha: 10000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
    const second = removeBatch(again, again.batches[0]?.id ?? "", { by: "মালিক", reason: "নষ্ট বা ভাঙা" }, LATER)
    expect(removedBatchLog(second).map((r) => r.batchNo)).toEqual(["B8", "B7"])
    expect(removedBatchLoss(second)).toBe(12 * 20000 + 5 * 10000)
    expect(removedBatchLog(emptyDb())).toEqual([])
    expect(removedBatchLoss(emptyDb())).toBe(0)
  })
  it("লগ ব্যাকআপে যায় ও ফেরে", () => {
    const { db, batchId } = setup()
    const out = removeBatch(db, batchId, { by: "মালিক", reason: "নষ্ট" }, LATER)
    const back = parseBackup(buildBackup(out, "store-1", LATER), "store-1")
    expect(back.db.removedBatches).toEqual(out.removedBatches)
  })
})
