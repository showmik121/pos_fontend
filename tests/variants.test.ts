import { describe, expect, it } from "vitest"
import { createProduct, updateProduct, type ProductInput } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { searchProducts } from "../src/lib/store/search"
import { groupByFamily, siblingsOf } from "../src/lib/store/variants"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"

const NOW = new Date("2026-11-12T10:00:00+06:00")

const base: ProductInput = { name: "Ponds Cream", unit: "piece", cartonSize: 1, costPoisha: 15000, pricePoisha: 20000, minStock: 2, category: "স্কিন কেয়ার", barcode: null, open: true }

function withVariants() {
  let db = emptyDb()
  const a = createProduct(db, { ...base, variant: "50ml" }, NOW)
  db = a.db
  const b = createProduct(db, { ...base, variant: "100ml", pricePoisha: 35000 }, NOW)
  db = b.db
  const plain = createProduct(db, { ...base, name: "Lux Soap", variant: undefined }, NOW)
  return { db: plain.db, a: a.product, b: b.product, plain: plain.product }
}

describe("ভ্যারিয়েন্ট (শেড/সাইজ)", () => {
  it("ভ্যারিয়েন্ট দিলে নাম হয় ফ্যামিলি · ভ্যারিয়েন্ট, আর ফ্যামিলি/ভ্যারিয়েন্ট আলাদা থাকে", () => {
    const { a } = withVariants()
    expect(a).toMatchObject({ name: "Ponds Cream · 50ml", family: "Ponds Cream", variant: "50ml" })
  })

  it("ভ্যারিয়েন্ট ছাড়া পণ্যে family/variant ফিল্ডই থাকে না (পুরনো আকার বদলায় না)", () => {
    const { plain } = withVariants()
    expect(plain.name).toBe("Lux Soap")
    expect("family" in plain).toBe(false)
    expect("variant" in plain).toBe(false)
  })

  it("একই ফ্যামিলিতে একই ভ্যারিয়েন্ট দুবার আটকায় (বড়-ছোট হাত নির্বিশেষে)", () => {
    const { db } = withVariants()
    expect(() => createProduct(db, { ...base, name: "ponds cream", variant: "50ML" }, NOW)).toThrow(/ভ্যারিয়েন্ট/)
  })

  it("সম্পাদনায় সাধারণ পণ্যে ভ্যারিয়েন্ট বসালে ফ্যামিলিতে ঢোকে, ফাঁকা করলে বেরোয়", () => {
    const { db, plain, a } = withVariants()
    const { barcode: _b, open: _o, ...edit } = base
    const joined = updateProduct(db, plain.id, { ...edit, name: "Ponds Cream", variant: "200ml" })
    expect(joined.products.find((p) => p.id === plain.id)).toMatchObject({ name: "Ponds Cream · 200ml", variant: "200ml" })
    expect(siblingsOf(joined, a).map((p) => p.variant)).toEqual(["100ml", "200ml"])
    const left = updateProduct(joined, plain.id, { ...edit, name: "Ponds Cream", variant: "" })
    const p = left.products.find((x) => x.id === plain.id)!
    expect(p.name).toBe("Ponds Cream")
    expect(p.variant).toBeUndefined()
    expect(p.family).toBeUndefined()
  })

  it("siblingsOf নিজেকে ও অন্য ফ্যামিলিকে বাদ দেয়, সংখ্যা ধরে সাজায়", () => {
    const { db, a, b, plain } = withVariants()
    expect(siblingsOf(db, a).map((p) => p.id)).toEqual([b.id])
    expect(siblingsOf(db, plain)).toEqual([])
  })

  it("groupByFamily ভ্যারিয়েন্ট জড়ো করে, সাধারণ পণ্য একা রাখে", () => {
    const { db } = withVariants()
    const groups = groupByFamily(searchProducts(db, ""))
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([["Lux Soap", 1], ["Ponds Cream", 2]])
  })

  it("ফ্যামিলির নামে খুঁজলে সব ভ্যারিয়েন্ট আসে", () => {
    const { db } = withVariants()
    expect(searchProducts(db, "ponds").map((p) => p.variant)).toEqual(["100ml", "50ml"])
  })

  it("ভ্যারিয়েন্ট বেশি লম্বা হলে আটকায়", () => {
    expect(() => createProduct(emptyDb(), { ...base, variant: "x".repeat(61) }, NOW)).toThrow(/লম্বা/)
  })

  it("সিংক: ভ্যারিয়েন্ট অন্য ডিভাইসে একই ফ্যামিলি/ভ্যারিয়েন্টসহ পৌঁছায়", () => {
    const before = emptyDb()
    const { db: after } = createProduct(before, { ...base, variant: "শেড ০২" }, NOW)
    let n = 0
    const { events } = eventsFromChange(before, after, () => `ev-${++n}`, NOW)
    const applied = applyEvents(before, events)
    expect(applied.ignored).toHaveLength(0)
    expect(applied.db.products[0]).toMatchObject({ name: "Ponds Cream · শেড ০২", family: "Ponds Cream", variant: "শেড ০২" })
  })
})
