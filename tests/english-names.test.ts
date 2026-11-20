import { describe, expect, it } from "vitest"
import { createProduct } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { searchProducts } from "../src/lib/store/search"

const NOW = new Date("2026-11-20T10:00:00+06:00")
const base = { unit: "piece" as const, cartonSize: 1, costPoisha: 100, pricePoisha: 200, minStock: 1, category: "Skin Care", barcode: null, open: false }

describe("ইংরেজি পণ্যের নাম", () => {
  it("ইংরেজি ও মিশ্র নামে পণ্য খোলা যায়, ছোট-বড় হাতের অক্ষর নির্বিশেষে খোঁজা যায়", () => {
    let db = emptyDb()
    db = createProduct(db, { ...base, name: "Pond's Cream" }, NOW).db
    db = createProduct(db, { ...base, name: "ডাভ Soap" }, NOW).db
    expect(searchProducts(db, "POND").map((p) => p.name)).toEqual(["Pond's Cream"])
    expect(searchProducts(db, "soap").map((p) => p.name)).toEqual(["ডাভ Soap"])
    expect(searchProducts(db, "skin care")).toHaveLength(2)
  })
})
