import { describe, expect, it } from "vitest"
import { addToCart, completeSale, createProduct, setCartQty, stockIn, updateProduct } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { lineQtyText, priceText, soldText, stockCountText } from "../src/lib/store/pack-text"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const uid = (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n + 7000).padStart(12, "0")}` })()

/** চাল: প্রতি কেজি ৮৫ টাকা = ৮৫ পয়সা প্রতি পিস (১ পিস = ১০ গ্রাম), ক্রয় ৭০ টাকা কেজি */
function rice() {
  const made = createProduct(emptyDb(), { name: "মিনিকেট চাল", unit: "piece", cartonSize: 1, costPoisha: 70, pricePoisha: 85, minStock: 0, category: "", barcode: null, open: true, measure: "kg" }, NOW)
  // ৫০ কেজি = ৫০০০ পিস
  const db = stockIn(made.db, { productId: made.product.id, qty: 5000, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 70, pricePoisha: null, requireBatchAndExpiry: false }, NOW)
  return { db, id: made.product.id }
}

describe("কেজিতে বিক্রির পণ্য", () => {
  it("পণ্যে measure থাকে, পাতা/স্ট্রিপ থাকলে আটকায়", () => {
    const { db } = rice()
    expect(db.products[0]?.measure).toBe("kg")
    expect(() => createProduct(emptyDb(), { name: "X", unit: "piece", cartonSize: 1, stripSize: 10, costPoisha: 1, pricePoisha: 2, minStock: 0, category: "", barcode: null, open: true, measure: "kg" }, NOW)).toThrow()
  })

  it("২.৫ কেজি বিক্রিতে মোট ২১২.৫ টাকা নয়, পূর্ণ পয়সায় ২১২৫০; স্টক ২৫০ পিস কমে", () => {
    const { db, id } = rice()
    const draft = addToCart(db.draft, id, 250)
    const { sale, db: after } = completeSale({ ...db, draft }, { cashier: "মালিক", cash: 21250, mobile: 0, mobileMethod: "bkash" }, NOW)
    expect(sale.total).toBe(250 * 85)
    expect(sale.lines[0]).toMatchObject({ qty: 250, unitPrice: 85 })
    expect(after.batches.reduce((n, b) => n + b.qtyRemaining, 0)).toBe(5000 - 250)
  })

  it("২৫০ গ্রাম = ২৫ পিস = ২১.২৫ টাকা (২১২৫ পয়সা), ওজন বদলালে মোট বদলায়", () => {
    const { db, id } = rice()
    const draft = setCartQty(addToCart(db.draft, id, 25), id, 25)
    expect(completeSale({ ...db, draft }, { cashier: "মালিক", cash: 2125, mobile: 0, mobileMethod: "bkash" }, NOW).sale.total).toBe(2125)
  })

  it("পরে measure বদলানো যায় না", () => {
    const { db, id } = rice()
    const out = updateProduct(db, id, { name: "চাল (নতুন)", unit: "piece", cartonSize: 1, costPoisha: 70, pricePoisha: 90, minStock: 0, category: "", barcode: null, open: true, measure: "l" }, NOW)
    expect(out.products[0]?.measure).toBe("kg")
    expect(out.products[0]?.pricePoisha).toBe(90)
  })

  it("দেখানোর লেখা কেজি/গ্রামে", () => {
    const p = rice().db.products[0]!
    expect(priceText(p)).toBe("৳ ৮৫/কেজি")
    expect(stockCountText(p, 250)).toContain("২.৫ কেজি")
    expect(soldText("kg", 25)).toContain("২৫০ গ্রাম")
    expect(lineQtyText("kg", 85, 250)).toBe("৳ ৮৫/কেজি × ২.৫ কেজি")
    expect(lineQtyText(undefined, 4000, 3)).toBe("৳ ৪০ × ৩")
  })

  it("সিংক: measure সহ পণ্য রিপ্লেতে একই থাকে এবং বিক্রি বসে", () => {
    const base = emptyDb()
    const made = createProduct(base, { name: "সয়াবিন তেল", unit: "piece", cartonSize: 1, costPoisha: 150, pricePoisha: 170, minStock: 0, category: "", barcode: null, open: true, measure: "l" }, NOW)
    const a = eventsFromChange(base, made.db, uid, NOW)
    const replayed = applyEvents(emptyDb(), a.events)
    expect(replayed.ignored.length).toBe(0)
    expect(replayed.db.products[0]?.measure).toBe("l")
  })
})
