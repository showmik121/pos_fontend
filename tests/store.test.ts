import { describe, expect, it } from "vitest"
import { addToCart, completeSale, createProduct, importProducts, receiveDue, removeBatch, setBillDiscount, setCartCustomer, setCartQty, addCustomer, stockIn } from "../src/lib/store/actions"
import { MAX_IMPORT_ROWS, parseCsv, validateImport } from "../src/lib/store/csv"
import { emptyDb } from "../src/lib/store/db"
import { customerBalance, daySummary, dueRows, expiryBuckets, findByBarcode, lowStockProducts, sellableStock, topProducts, totalStock } from "../src/lib/store/selectors"
import { withDemoData } from "../src/lib/store/seed"
import type { Db } from "../src/lib/store/types"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const TODAY = "2026-11-12"

function setup(): { db: Db; pondsId: string } {
  let db = emptyDb()
  const made = createProduct(db, { name: "পন্ডস ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "স্কিন কেয়ার", barcode: "8901234567890", open: false }, NOW)
  db = made.db
  db = stockIn(db, { productId: made.product.id, qty: 3, unit: "carton", batchNo: "B2407", expiryDate: "2027-06-30", costPoisha: 200000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  return { db, pondsId: made.product.id }
}

describe("পণ্য ও স্টক-ইন", () => {
  it("বারকোড ডুপ্লিকেট আটকায়, নাম ও দাম লাগে", () => {
    const { db } = setup()
    const input = { name: "অন্য", unit: "piece" as const, cartonSize: 1, costPoisha: 0, pricePoisha: 100, minStock: 0, category: "", barcode: "8901234567890", open: false }
    expect(() => createProduct(db, input, NOW)).toThrow()
    expect(() => createProduct(db, { ...input, barcode: null, name: " " }, NOW)).toThrow()
    expect(() => createProduct(db, { ...input, barcode: null, pricePoisha: 0 }, NOW)).toThrow()
  })
  it("কার্টন পিসে বদলে স্টকে যোগ হয়, পিস প্রতি খরচ হিসাব হয়", () => {
    const { db, pondsId } = setup()
    expect(totalStock(db, pondsId)).toBe(30)
    expect(db.products[0]?.costPoisha).toBe(20000)
    expect(findByBarcode(db, "8901234567890")?.product.id).toBe(pondsId)
  })
  it("ফার্মেসিতে ব্যাচ ও মেয়াদ বাধ্যতামূলক", () => {
    const { db, pondsId } = setup()
    expect(() => stockIn(db, { productId: pondsId, qty: 1, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 1, pricePoisha: null, requireBatchAndExpiry: true }, NOW)).toThrow()
  })
  it("একই ব্যাচ আবার এলে যোগ হয়ে যায়", () => {
    const { db, pondsId } = setup()
    const next = stockIn(db, { productId: pondsId, qty: 5, unit: "piece", batchNo: "B2407", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
    expect(next.batches).toHaveLength(1)
    expect(totalStock(next, pondsId)).toBe(35)
  })
})

describe("বিক্রি", () => {
  it("বিল সম্পন্ন করলে স্টক কমে, বিল নম্বর বাড়ে, কার্ট ফাঁকা হয়", () => {
    const { db: base, pondsId } = setup()
    const db = { ...base, draft: addToCart(base.draft, pondsId, 4) }
    const { db: after, sale } = completeSale(db, { cashier: "রুবেল", cash: 96000, mobile: 0, mobileMethod: "bkash" }, NOW)
    expect(sale.no).toBe(1001)
    expect(sale.total).toBe(96000)
    expect(totalStock(after, pondsId)).toBe(26)
    expect(after.draft.lines).toHaveLength(0)
    expect(sale.lines[0]?.allocations[0]?.batchNo).toBe("B2407")
  })
  it("স্টকের বেশি বিক্রি আটকায় এবং কিছুই বদলায় না", () => {
    const { db: base, pondsId } = setup()
    const db = { ...base, draft: addToCart(base.draft, pondsId, 31) }
    expect(() => completeSale(db, { cashier: "x", cash: 99999999, mobile: 0, mobileMethod: "bkash" }, NOW)).toThrow()
    expect(totalStock(db, pondsId)).toBe(30)
  })
  it("কার্টের পরিমাণ ও ছাড় বদলানো যায়", () => {
    const { db, pondsId } = setup()
    let d = addToCart(db.draft, pondsId, 2)
    d = setCartQty(d, pondsId, 5)
    expect(d.lines[0]?.qty).toBe(5)
    d = setBillDiscount(d, { type: "amount", value: 1000 })
    expect(d.bill.value).toBe(1000)
    expect(setCartQty(d, pondsId, 0).lines).toHaveLength(0)
  })
  it("বাকিতে বিক্রি করলে খাতায় জমা হয়, জমা নিলে কমে, বেশি জমা আটকায়", () => {
    const { db: base, pondsId } = setup()
    const c = addCustomer(base, { name: "রহিম", phone: "০১৭১১০০০০০০" }, NOW)
    let db = { ...c.db, draft: setCartCustomer(addToCart(c.db.draft, pondsId, 1), c.customer.id) }
    const sold = completeSale(db, { cashier: "আমি", cash: 20000, mobile: 0, mobileMethod: "bkash" }, NOW)
    db = sold.db
    expect(sold.sale.due).toBe(4000)
    expect(customerBalance(db, c.customer.id)).toBe(4000)
    expect(dueRows(db)).toHaveLength(1)
    expect(() => receiveDue(db, c.customer.id, 5000, "আমি", NOW)).toThrow()
    db = receiveDue(db, c.customer.id, 4000, "আমি", NOW)
    expect(customerBalance(db, c.customer.id)).toBe(0)
    expect(dueRows(db)).toHaveLength(0)
  })
  it("ফোন নম্বর ঠিকভাবে সংরক্ষিত ও ডুপ্লিকেট আটকায়", () => {
    const c = addCustomer(emptyDb(), { name: "রহিম", phone: "+8801711000000" }, NOW)
    expect(c.customer.phone).toBe("01711000000")
    expect(() => addCustomer(c.db, { name: "অন্য", phone: "01711000000" }, NOW)).toThrow()
    expect(() => addCustomer(c.db, { name: "ভুল", phone: "123" }, NOW)).toThrow()
  })
})

describe("রিপোর্ট", () => {
  it("দিনের হিসাব মেলে: নগদ + মোবাইল + বাকি = মোট (ফেরতসহ)", () => {
    const { db: base, pondsId } = setup()
    const c = addCustomer(base, { name: "রহিম", phone: "" }, NOW)
    let db = { ...c.db, draft: addToCart(c.db.draft, pondsId, 2) } // ৪৮০
    db = completeSale(db, { cashier: "x", cash: 50000, mobile: 0, mobileMethod: "bkash" }, NOW).db // নগদ ৫০০, ফেরত ২০
    db = { ...db, draft: setCartCustomer(addToCart(db.draft, pondsId, 1), c.customer.id) } // ২৪০
    db = completeSale(db, { cashier: "x", cash: 10000, mobile: 5000, mobileMethod: "nagad" }, NOW).db // বাকি ৯০
    const s = daySummary(db, TODAY)
    expect(s.bills).toBe(2)
    expect(s.total).toBe(72000)
    expect(s.cash + s.mobile + s.due).toBe(s.total)
    expect(s.due).toBe(9000)
    expect(s.profit).toBe(72000 - 3 * 20000)
  })
  it("বেশি বিক্রি হওয়া পণ্য পরিমাণ অনুযায়ী সাজায়", () => {
    const { db: base, pondsId } = setup()
    const db = completeSale({ ...base, draft: addToCart(base.draft, pondsId, 3) }, { cashier: "x", cash: 72000, mobile: 0, mobileMethod: "bkash" }, NOW).db
    const top = topProducts(db, "2026-11-06", TODAY)
    expect(top[0]).toMatchObject({ qty: 3, revenue: 72000 })
  })
})

describe("অ্যালার্ট", () => {
  it("নমুনা তথ্যে মেয়াদ ও কম স্টক ধরা পড়ে, মেয়াদোত্তীর্ণ বিক্রয়যোগ্য নয়", () => {
    const db = withDemoData(emptyDb(), NOW)
    const b = expiryBuckets(db, TODAY)
    expect(b.expired).toHaveLength(1)
    expect(b.within30.length).toBeGreaterThanOrEqual(3)
    expect(lowStockProducts(db, TODAY).map((p) => p.name)).toContain("ডেটল সাবান ১২৫ গ্রাম")
    const seclo = db.products.find((p) => p.name.startsWith("সেকলো"))
    expect(seclo && sellableStock(db, seclo.id, TODAY)).toBe(20)
    const expired = b.expired[0]
    expect(expired && removeBatch(db, expired.batch.id, { by: "মালিক", reason: "মেয়াদ শেষ" }, NOW).batches.length).toBe(db.batches.length - 1)
  })
})

describe("CSV ইমপোর্ট", () => {
  const csv = [
    "barcode,name,cost,price,unit,carton_size,min_stock,category,batch,expiry,qty",
    "111,ভালো পণ্য,50,60,piece,10,5,সাধারণ,B1,06/2027,20",
    "222,দাম নেই,50,,piece,1,5,,,,",
    "111,ডুপ্লিকেট,50,60,piece,1,5,,,,",
    "333,মেয়াদ ভুল,50,60,piece,1,5,,B2,2027-06,5",
  ].join("\n")
  it("ঠিক ও ভুল সারি আলাদা করে", () => {
    const { ok, errors } = validateImport(parseCsv(csv), emptyDb())
    expect(ok).toHaveLength(1)
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5])
    expect(errors[0]?.message).toBe("বিক্রয়মূল্য ফাঁকা")
    expect(errors[1]?.message).toBe("বারকোড আগে থেকেই আছে")
  })
  it("ঠিক সারিগুলো পণ্য ও স্টক হয়ে যোগ হয়", () => {
    const { ok } = validateImport(parseCsv(csv), emptyDb())
    const db = importProducts(emptyDb(), ok, NOW)
    expect(db.products).toHaveLength(1)
    expect(totalStock(db, db.products[0]?.id ?? "")).toBe(20)
  })
  it("কোটেশনসহ কমা ও BOM পড়ে", () => {
    expect(parseCsv('﻿a,"b,c"\n1,2')).toEqual([["a", "b,c"], ["1", "2"]])
  })
})

describe("CSV ইমপোর্টের নিরাপত্তা", () => {
  const HEAD = "name,price,unit"
  it("প্রোটোটাইপ নামের একক (constructor, __proto__) বাতিল হয়", () => {
    for (const bad of ["constructor", "__proto__", "toString"]) {
      const out = validateImport(parseCsv(`${HEAD}\nপণ্য,100,${bad}`), emptyDb())
      expect(out.ok).toHaveLength(0)
      expect(out.errors[0]?.message).toContain("একক")
    }
  })
  it("চেনা একক ও ফাঁকা একক চলে", () => {
    const out = validateImport(parseCsv(`${HEAD}\nক,100,strip\nখ,100,\nগ,100,পিস`), emptyDb())
    expect(out.errors).toEqual([])
    expect(out.ok.map((r) => r.unit)).toEqual(["strip", "piece", "piece"])
  })
  it("সীমার বেশি সারি এলে পুরো ফাইল ফেরত", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `পণ্য${i},100,piece`).join("\n")
    const out = validateImport(parseCsv(`${HEAD}\n${rows}`), emptyDb())
    expect(out.ok).toHaveLength(0)
    expect(out.errors).toHaveLength(1)
  })
})
