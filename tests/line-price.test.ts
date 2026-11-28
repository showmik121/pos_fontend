import { describe, expect, it } from "vitest"
import { addToCart, completeSale, createProduct, setCartLinePrice, setLineDiscounts, setProductPrice, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { lineUnitPrice } from "../src/lib/store/line-price"

const NOW = new Date("2026-11-12T10:00:00+06:00")

function shop() {
  const made = createProduct(emptyDb(), { name: "Soap", unit: "piece", cartonSize: 1, costPoisha: 1000, pricePoisha: 2400, minStock: 0, category: "", barcode: null, open: true }, NOW)
  const db = stockIn(made.db, { productId: made.product.id, qty: 10, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 1000, pricePoisha: null, requireBatchAndExpiry: false }, NOW)
  return { db, id: made.product.id }
}

const pay = (db: ReturnType<typeof shop>["db"], total: number) => completeSale(db, { cashier: "মালিক", cash: total, mobile: 0, mobileMethod: "bkash" }, NOW)

describe("বিলে দাম বদল", () => {
  it("বিলের দাম বদলালে বিক্রি সেই দামে হয়, পণ্যের তালিকা-দাম বদলায় না", () => {
    const { db, id } = shop()
    const draft = setCartLinePrice(addToCart(db.draft, id, 2), id, 2000)
    const { sale, db: after } = pay({ ...db, draft }, 4000)
    expect(sale.lines[0]).toMatchObject({ unitPrice: 2000, qty: 2 })
    expect(sale.total).toBe(4000)
    expect(after.products[0]?.pricePoisha).toBe(2400)
  })

  it("null দিলে তালিকা-দামে ফেরে, আর দাম ঘরটা লাইন থেকে সরে যায়", () => {
    const { db, id } = shop()
    const changed = setCartLinePrice(addToCart(db.draft, id, 1), id, 2000)
    expect(changed.lines[0]?.unitPrice).toBe(2000)
    const reset = setCartLinePrice(changed, id, null)
    expect("unitPrice" in (reset.lines[0] ?? {})).toBe(false)
    expect(lineUnitPrice(reset.lines[0]!, db.products[0]!)).toBe(2400)
  })

  it("বদলানো দামের ওপর ছাড় হিসাব হয়, ছাড় দামের বেশি হলে আটকায়", () => {
    const { db, id } = shop()
    const draft = setLineDiscounts(setCartLinePrice(addToCart(db.draft, id, 1), id, 2000), { [id]: 500 })
    expect(pay({ ...db, draft }, 1500).sale.total).toBe(1500)
    const tooMuch = setLineDiscounts(setCartLinePrice(addToCart(db.draft, id, 1), id, 2000), { [id]: 2500 })
    expect(() => pay({ ...db, draft: tooMuch }, 0)).toThrow(/ছাড়/)
  })

  it("শূন্য বা ভগ্নাংশ দাম আটকায়", () => {
    const { db, id } = shop()
    const draft = addToCart(db.draft, id, 1)
    expect(() => setCartLinePrice(draft, id, 0)).toThrow()
    expect(() => setCartLinePrice(draft, id, 12.5)).toThrow()
  })

  it("setProductPrice তালিকা-দাম বদলায়", () => {
    const { db, id } = shop()
    expect(setProductPrice(db, id, 3000).products[0]?.pricePoisha).toBe(3000)
    expect(() => setProductPrice(db, id, 0)).toThrow()
  })
})
