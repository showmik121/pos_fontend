import { describe, expect, it } from "vitest"
import { addCustomer, addToCart, completeSale, createProduct, receiveDue, removeBatch, setCartCustomer, stockIn, voidSale } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { customerBalance, daySummary, dueRows, topProducts, totalStock } from "../src/lib/store/selectors"
import type { Db } from "../src/lib/store/types"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const LATER = new Date("2026-11-12T15:00:00+06:00")
const TODAY = "2026-11-12"

function setup(): { db: Db; productId: string } {
  const made = createProduct(emptyDb(), { name: "পন্ডস ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "890", open: false }, NOW)
  const db = stockIn(made.db, { productId: made.product.id, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  return { db, productId: made.product.id }
}

function sell(db: Db, productId: string, qty: number, cash: number, customerId: string | null = null) {
  const d = { ...db, draft: setCartCustomer(addToCart(db.draft, productId, qty), customerId) }
  return completeSale(d, { cashier: "রুবেল", cash, mobile: 0, mobileMethod: "bkash" }, NOW)
}

describe("বিল বাতিল", () => {
  it("স্টক ব্যাচে ফেরত যায়, বিল বাতিল চিহ্নিত হয়, কে/কেন/কখন থাকে", () => {
    const { db, productId } = setup()
    const sold = sell(db, productId, 4, 96000)
    const out = voidSale(sold.db, sold.sale.id, { by: "মালিক", reason: "ভুল পণ্য" }, LATER)
    expect(totalStock(out.db, productId)).toBe(30)
    expect(out.restoredQty).toBe(4)
    expect(out.lostQty).toBe(0)
    expect(out.refundPoisha).toBe(96000)
    const v = out.db.sales[0]?.voided
    expect(v).toEqual({ at: LATER.toISOString(), by: "মালিক", reason: "ভুল পণ্য" })
  })
  it("পুরনো ডেটা বদলায় না (immutable)", () => {
    const { db, productId } = setup()
    const sold = sell(db, productId, 2, 48000)
    voidSale(sold.db, sold.sale.id, { by: "মালিক", reason: "ভুল" }, LATER)
    expect(sold.db.sales[0]?.voided).toBeUndefined()
    expect(totalStock(sold.db, productId)).toBe(28)
  })
  it("দ্বিতীয়বার বাতিল ও অজানা বিল আটকায়, কারণ লাগে", () => {
    const { db, productId } = setup()
    const sold = sell(db, productId, 1, 24000)
    const once = voidSale(sold.db, sold.sale.id, { by: "মালিক", reason: "ভুল" }, LATER).db
    expect(() => voidSale(once, sold.sale.id, { by: "মালিক", reason: "ভুল" }, LATER)).toThrow(/আগেই বাতিল/)
    expect(() => voidSale(sold.db, "nope", { by: "মালিক", reason: "ভুল" }, LATER)).toThrow()
    expect(() => voidSale(sold.db, sold.sale.id, { by: "মালিক", reason: "  " }, LATER)).toThrow(/কারণ/)
  })
  it("বাকির বিল বাতিলে কাস্টমারের বাকি শূন্য হয়", () => {
    const { db, productId } = setup()
    const c = addCustomer(db, { name: "রহিম", phone: "০১৭১১০০০০০১" }, NOW)
    const sold = sell(c.db, productId, 2, 10000, c.customer.id) // মোট ৪৮০, নগদ ১০০, বাকি ৩৮০
    expect(customerBalance(sold.db, c.customer.id)).toBe(38000)
    const out = voidSale(sold.db, sold.sale.id, { by: "মালিক", reason: "ফেরত" }, LATER)
    expect(customerBalance(out.db, c.customer.id)).toBe(0)
    expect(dueRows(out.db)).toHaveLength(0)
    expect(out.refundPoisha).toBe(10000)
  })
  it("পরে আংশিক বাকি শোধ হয়ে থাকলে ফেরতযোগ্য টাকায় তা ধরা হয়, বাকি ঋণাত্মক হয় না", () => {
    const { db, productId } = setup()
    const c = addCustomer(db, { name: "করিম", phone: "০১৭১১০০০০০২" }, NOW)
    const sold = sell(c.db, productId, 2, 10000, c.customer.id) // বাকি ৩৮০
    const paid = receiveDue(sold.db, c.customer.id, 20000, "রুবেল", NOW) // পরে ২০০ শোধ → বাকি ১৮০
    const out = voidSale(paid, sold.sale.id, { by: "মালিক", reason: "ফেরত" }, LATER)
    expect(customerBalance(out.db, c.customer.id)).toBe(0)
    expect(out.refundPoisha).toBe(10000 + 20000) // বিলের সময়ের নগদ + পরে শোধ
  })
  it("ব্যাচ আগেই মুছে ফেলা হলে সেই পরিমাণ ফেরানো যায় না, জানানো হয় (মেয়াদ ছাড়া নতুন ব্যাচ বানানো হয় না)", () => {
    const { db, productId } = setup()
    const sold = sell(db, productId, 3, 72000)
    const batchId = sold.sale.lines[0]?.allocations[0]?.batchId ?? ""
    const noBatch = removeBatch(sold.db, batchId, { by: "মালিক", reason: "নষ্ট" }, LATER)
    const out = voidSale(noBatch, sold.sale.id, { by: "মালিক", reason: "ভুল" }, LATER)
    expect(out.restoredQty).toBe(0)
    expect(out.lostQty).toBe(3)
    expect(totalStock(out.db, productId)).toBe(0)
  })
  it("বাতিল বিল দিনের হিসাব ও সেরা-পণ্যে ধরা হয় না", () => {
    const { db, productId } = setup()
    const a = sell(db, productId, 2, 48000)
    const b = sell(a.db, productId, 1, 24000)
    const out = voidSale(b.db, a.sale.id, { by: "মালিক", reason: "ভুল" }, LATER)
    const day = daySummary(out.db, TODAY)
    expect(day.bills).toBe(1)
    expect(day.total).toBe(24000)
    expect(day.cash).toBe(24000)
    expect(topProducts(out.db, TODAY, TODAY)[0]?.qty).toBe(1)
  })
})
