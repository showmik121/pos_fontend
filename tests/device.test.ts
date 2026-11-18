import { beforeEach, describe, expect, it } from "vitest"
import { addToCart, completeSale, createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { deviceStorageKey, loadDevice, parseDevice, saveDeviceCode } from "../src/lib/store/device"
import { formatBillNo } from "../src/lib/domain/bill"

const NOW = new Date("2026-11-12T10:00:00+06:00")

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

function setup() {
  const made = createProduct(emptyDb(), { name: "ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "1", open: false }, NOW)
  const db = stockIn(made.db, { productId: made.product.id, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  return { db: { ...db, draft: addToCart(db.draft, made.product.id, 1) } }
}

describe("বিল নম্বর ফরম্যাট", () => {
  it("উপসর্গ থাকলে 'A-১০০১', না থাকলে শুধু বাংলা অঙ্ক", () => {
    expect(formatBillNo({ no: 1001, prefix: "A" })).toBe("A-১০০১")
    expect(formatBillNo({ no: 1001 })).toBe("১০০১")
  })
})

describe("সেলে ডিভাইস-উপসর্গ", () => {
  it("devicePrefix দিলে বিল ও বাকির এন্ট্রিতে উপসর্গ বসে, কাউন্টার এগোয়", () => {
    const { db } = setup()
    const out = completeSale(db, { cashier: "রুবেল", cash: 24000, mobile: 0, mobileMethod: "bkash", devicePrefix: "B" }, NOW)
    expect(out.sale.no).toBe(1001)
    expect(out.sale.prefix).toBe("B")
    expect(out.db.billCounter).toBe(1001)
  })
  it("উপসর্গ না দিলে (ডিভাইস নিবন্ধিত নয়) prefix থাকে না", () => {
    const { db } = setup()
    const out = completeSale(db, { cashier: "রুবেল", cash: 24000, mobile: 0, mobileMethod: "bkash" }, NOW)
    expect(out.sale.prefix).toBeUndefined()
  })
})

describe("ডিভাইস পরিচয় (লোকাল)", () => {
  let storage: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    storage = memoryStorage()
  })
  it("প্রথমবার নতুন id বানায়, পরেরবার একই id দেয়", () => {
    const a = loadDevice("store1", storage)
    const b = loadDevice("store1", storage)
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(b.id).toBe(a.id)
    expect(a.code).toBeNull()
  })
  it("দোকান আলাদা হলে ডিভাইস id আলাদা", () => {
    expect(loadDevice("s1", storage).id).not.toBe(loadDevice("s2", storage).id)
  })
  it("কোড সেভ হয় এবং id একই থাকে", () => {
    const a = loadDevice("s1", storage)
    saveDeviceCode("s1", "C", storage)
    const b = loadDevice("s1", storage)
    expect(b).toEqual({ id: a.id, code: "C" })
  })
  it("নষ্ট ডেটা থাকলে নতুন id, কোড null", () => {
    storage.setItem(deviceStorageKey("s1"), "{bad")
    expect(loadDevice("s1", storage).code).toBeNull()
    expect(parseDevice(JSON.stringify({ id: 5, code: "Z" }))).toBeNull()
    expect(parseDevice(JSON.stringify({ id: "abcdefgh-1", code: "ab" }))?.code).toBeNull()
  })
  it("স্টোরেজ ছুঁড়লে ভেঙে পড়ে না", () => {
    const broken = { getItem: () => { throw new Error("blocked") }, setItem: () => { throw new Error("blocked") }, removeItem: () => {} }
    expect(loadDevice("s1", broken).code).toBeNull()
    expect(() => saveDeviceCode("s1", "A", broken)).not.toThrow()
  })
})

describe("বাকির খাতায় বিল উপসর্গ", () => {
  it("বাকিতে বিক্রিতে খাতার এন্ট্রিতে salePrefix থাকে", async () => {
    const { addCustomer, setCartCustomer } = await import("../src/lib/store/actions")
    const { db } = setup()
    const withCustomer = addCustomer(db, { name: "করিম", phone: "০১৭১১০০০০০১" }, NOW)
    const d = { ...withCustomer.db, draft: setCartCustomer(withCustomer.db.draft, withCustomer.customer.id) }
    const out = completeSale(d, { cashier: "রুবেল", cash: 0, mobile: 0, mobileMethod: "bkash", devicePrefix: "A" }, NOW)
    const entry = out.db.ledger.find((e) => e.kind === "sale")
    expect(entry?.salePrefix).toBe("A")
    expect(entry?.saleNo).toBe(1001)
  })
})
