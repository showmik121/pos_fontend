import { describe, expect, it } from "vitest"
import { addToCart, completeSale, createProduct, importProducts, setCartQty, stockIn, updateProduct, type ProductInput } from "../src/lib/store/actions"
import { parseCsv, validateImport } from "../src/lib/store/csv"
import { emptyDb } from "../src/lib/store/db"
import { packBreakdown, toPieces } from "../src/lib/domain/units"
import { packChoices, packText, stockCountText } from "../src/lib/store/pack-text"
import { sellableStock, totalStock } from "../src/lib/store/selectors"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"
import { phoneticKey } from "../src/lib/store/phonetic"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const TODAY = "2026-11-12"
const base: ProductInput = { name: "Napa", unit: "piece", cartonSize: 100, stripSize: 10, costPoisha: 100, pricePoisha: 120, minStock: 20, category: "", barcode: null, open: true }

function napaDb(qty = 250) {
  const made = createProduct(emptyDb(), base, NOW)
  const db = stockIn(made.db, { productId: made.product.id, qty, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 100, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  return { db, id: made.product.id }
}

describe("পাতা ও পিসের রূপান্তর", () => {
  it("পাতা থেকে পিস; মাপ না থাকলে বাংলা বার্তাসহ ত্রুটি", () => {
    expect(toPieces({ qty: 3, unit: "strip", stripSize: 10, cartonSize: 100 })).toBe(30)
    expect(toPieces({ qty: 2, unit: "carton", stripSize: 10, cartonSize: 100 })).toBe(200)
    expect(toPieces({ qty: 7, unit: "piece", stripSize: 10, cartonSize: 100 })).toBe(7)
    expect(() => toPieces({ qty: 1, unit: "strip", stripSize: 1, cartonSize: 100 })).toThrow(/পাতার সাইজ/)
    expect(() => toPieces({ qty: 0, unit: "strip", stripSize: 10, cartonSize: 100 })).toThrow()
  })
  it("পিসকে বক্স-পাতা-পিসে ভাঙে", () => {
    expect(packBreakdown(257, 10, 100)).toEqual({ boxes: 2, strips: 5, pieces: 7 })
    expect(packBreakdown(9, 10, 100)).toEqual({ boxes: 0, strips: 0, pieces: 9 })
    expect(packBreakdown(25, 10, 1)).toEqual({ boxes: 0, strips: 2, pieces: 5 })
    expect(packBreakdown(25, 1, 1)).toEqual({ boxes: 0, strips: 0, pieces: 25 })
  })
  it("লেখার রূপ: শূন্য ধাপ বাদ, সব শূন্য হলে ০ পিস", () => {
    const p = { stripSize: 10, cartonSize: 100 }
    expect(packText(257, p)).toBe("২ বক্স ৫ পাতা ৭ পিস")
    expect(packText(200, p)).toBe("২ বক্স")
    expect(packText(0, p)).toBe("০ পিস")
    expect(stockCountText({ stripSize: 10, cartonSize: 100 }, 257)).toBe("২৫ পাতা ৭ পিস")
    expect(stockCountText({ stripSize: undefined, cartonSize: 1 }, 257)).toBe("২৫৭")
  })
})

describe("স্টক-জমা ও বিক্রি", () => {
  it("পাতায় স্টক জমা: পিস হয়, ক্রয়মূল্য পাতা থেকে পিসের হিসাবে ভাগ হয়", () => {
    const made = createProduct(emptyDb(), base, NOW)
    const db = stockIn(made.db, { productId: made.product.id, qty: 3, unit: "strip", batchNo: "B", expiryDate: "2027-06-30", costPoisha: 1000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
    expect(totalStock(db, made.product.id)).toBe(30)
    expect(db.batches[0]?.costPoisha).toBe(100)
  })
  it("পাতার মাপ ছাড়া পণ্যে পাতায় জমা আটকায়", () => {
    const made = createProduct(emptyDb(), { ...base, stripSize: undefined }, NOW)
    expect(() => stockIn(made.db, { productId: made.product.id, qty: 1, unit: "strip", batchNo: "", expiryDate: null, costPoisha: 1, pricePoisha: null, requireBatchAndExpiry: false }, NOW)).toThrow(/পাতার সাইজ/)
  })
  it("পাতা কেটে ২ পিস বিক্রি: স্টক ঠিক ২ কমে, দাম পিস অনুযায়ী", () => {
    const { db, id } = napaDb()
    const draft = addToCart(db.draft, id, 2)
    const out = completeSale({ ...db, draft }, { cashier: "রুবেল", cash: 240, mobile: 0, mobileMethod: "bkash" }, NOW)
    expect(sellableStock(out.db, id, TODAY)).toBe(248)
    expect(out.sale.total).toBe(240)
  })
  it("১ পাতা + ৫ পিস = ১৫ পিস একই বিলে, দাম ১৫ × ১২০", () => {
    const { db, id } = napaDb()
    const choices = packChoices({ stripSize: 10 }, true)
    expect(choices.map((c) => c.qty)).toEqual([1, 2, 5, 10, 20])
    let draft = addToCart(db.draft, id, 10)
    draft = setCartQty(draft, id, 15)
    const out = completeSale({ ...db, draft }, { cashier: "রুবেল", cash: 1800, mobile: 0, mobileMethod: "bkash" }, NOW)
    expect(out.sale.total).toBe(1800)
    expect(sellableStock(out.db, id, TODAY)).toBe(235)
  })
  it("পাতা ছোট হলে (৩ পিস) বড় বোতাম বাদ: ২ পিস, ১ পাতা, ২ পাতা", () => {
    expect(packChoices({ stripSize: 3 }, false).map((c) => c.qty)).toEqual([2, 3, 6])
    expect(packChoices({ stripSize: undefined }, true)).toEqual([])
  })
})

describe("পণ্যের তথ্য ও সিংক", () => {
  it("১ বা ফাঁকা মাপ পণ্যে লেখা হয় না; সম্পাদনায় মুছে ফেলা যায়", () => {
    const one = createProduct(emptyDb(), { ...base, stripSize: 1 }, NOW).product
    expect("stripSize" in one).toBe(false)
    const { db, id } = napaDb()
    const cleared = updateProduct(db, id, { ...base, stripSize: undefined })
    expect(cleared.products[0]?.stripSize).toBeUndefined()
    expect(() => createProduct(emptyDb(), { ...base, stripSize: 0 }, NOW)).toThrow()
  })
  it("পাতার মাপ সিংকে অন্য ডিভাইসে পৌঁছায়", () => {
    const made = createProduct(emptyDb(), base, NOW)
    let n = 0
    const out = eventsFromChange(emptyDb(), made.db, () => `00000000-0000-4000-8000-${String(++n + 500).padStart(12, "0")}`, NOW)
    const replayed = applyEvents(emptyDb(), out.events)
    expect(replayed.ignored).toEqual([])
    expect(replayed.db.products[0]?.stripSize).toBe(10)
  })
  it("CSV: strip_size কলাম বসে; ভুল মান লাইনসহ ধরা পড়ে", () => {
    const { ok, errors } = validateImport(parseCsv("name,price,strip_size\nNapa,1.2,10\nBad,1,abc\n"), emptyDb())
    expect(ok[0]?.stripSize).toBe(10)
    expect(errors).toHaveLength(1)
    expect(importProducts(emptyDb(), ok, NOW).products[0]?.stripSize).toBe(10)
  })
  it("বানান-চাবি অপরিবর্তিত", () => {
    expect(phoneticKey("Napa")).toBe(phoneticKey("নাপা"))
  })
})
