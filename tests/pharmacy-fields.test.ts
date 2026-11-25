import { describe, expect, it } from "vitest"
import { createProduct, importProducts, updateProduct, type ProductInput } from "../src/lib/store/actions"
import { parseCsv, validateImport, IMPORT_TEMPLATE_CSV } from "../src/lib/store/csv"
import { emptyDb } from "../src/lib/store/db"
import { phoneticKey } from "../src/lib/store/phonetic"
import { productDetailLine, searchProducts } from "../src/lib/store/search"
import { DOSAGE_FORMS } from "../src/lib/store/types"
import { EN } from "../src/lib/i18n/en"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"

const NOW = new Date("2026-11-12T10:00:00+06:00")
const base: ProductInput = { name: "Napa", unit: "strip", cartonSize: 10, costPoisha: 100, pricePoisha: 120, minStock: 5, category: "", barcode: null, open: true }

function pharmacyDb() {
  let db = emptyDb()
  const add = (input: Partial<ProductInput>) => {
    db = createProduct(db, { ...base, ...input }, NOW).db
  }
  add({ name: "Napa", generic: "Paracetamol", strength: "500 mg", form: "tablet", company: "Beximco" })
  add({ name: "Ace", generic: "Paracetamol", strength: "500 mg", form: "tablet", company: "Square" })
  add({ name: "Seclo", generic: "Omeprazole", strength: "20 mg", form: "capsule", company: "Square" })
  add({ name: "Pond's Cream", category: "স্কিন কেয়ার" })
  return db
}
const names = (db: ReturnType<typeof pharmacyDb>, q: string) => searchProducts(db, q).map((p) => p.name)

describe("ওষুধের তথ্য সংরক্ষণ", () => {
  it("জেনেরিক, শক্তি, ধরন ও কোম্পানি ছেঁটে সেভ হয়; ফাঁকা ঘর পণ্যে লেখা হয় না", () => {
    const made = createProduct(emptyDb(), { ...base, generic: " Paracetamol ", strength: "", form: null, company: "  " }, NOW).product
    expect(made.generic).toBe("Paracetamol")
    expect("strength" in made).toBe(false)
    expect("form" in made).toBe(false)
    expect("company" in made).toBe(false)
  })
  it("সম্পাদনায় ঘর ফাঁকা করলে তথ্য মুছে যায়, বাকি পণ্য অক্ষত", () => {
    const db = pharmacyDb()
    const napa = db.products[0]!
    const next = updateProduct(db, napa.id, { ...base, name: "Napa", generic: "", strength: "650 mg", form: null, company: "Beximco" })
    const edited = next.products[0]!
    expect(edited.generic).toBeUndefined()
    expect(edited.strength).toBe("650 mg")
    expect(edited.form).toBeUndefined()
    expect(next.products[1]).toBe(db.products[1])
  })
  it("অচেনা ধরন বা অতি লম্বা লেখা আটকায়", () => {
    expect(() => createProduct(emptyDb(), { ...base, form: "magic" as never }, NOW)).toThrow()
    expect(() => createProduct(emptyDb(), { ...base, generic: "x".repeat(121) }, NOW)).toThrow()
    expect(() => createProduct(emptyDb(), { ...base, strength: "x".repeat(41) }, NOW)).toThrow()
  })
  it("প্রতিটি ধরনের ইংরেজি অনুবাদ আছে", () => {
    for (const label of Object.values(DOSAGE_FORMS)) expect(EN[label], label).toBeTruthy()
  })
})

describe("সার্চ: নাম, জেনেরিক, শক্তি, ধরন, কোম্পানি; বাংলা ও ইংরেজি বানান", () => {
  const db = pharmacyDb()
  it("জেনেরিক নামে সব ব্র্যান্ড পাওয়া যায়", () => {
    expect(names(db, "paracetamol").sort()).toEqual(["Ace", "Napa"])
  })
  it("বাংলা বানানে ইংরেজি জেনেরিক মেলে", () => {
    expect(names(db, "প্যারাসিটামল").sort()).toEqual(["Ace", "Napa"])
    expect(names(db, "ওমিপ্রাজল")).toEqual(["Seclo"])
  })
  it("বাংলায় লেখা পণ্যনামও ইংরেজি বানানে মেলে", () => {
    let d = emptyDb()
    d = createProduct(d, { ...base, name: "নাপা", generic: "প্যারাসিটামল" }, NOW).db
    expect(searchProducts(d, "napa").map((p) => p.name)).toEqual(["নাপা"])
    expect(searchProducts(d, "paracetamol").map((p) => p.name)).toEqual(["নাপা"])
  })
  it("একাধিক শব্দে সবকটি মিলতে হয় (নাম + শক্তি, কোম্পানি + ধরন)", () => {
    expect(names(db, "napa 500")).toEqual(["Napa"])
    expect(names(db, "square capsule")).toEqual(["Seclo"])
    expect(names(db, "napa 650")).toEqual([])
  })
  it("সরাসরি মিল বানান-মিলের আগে আসে, নামের শুরুর মিল সবার আগে", () => {
    expect(names(db, "ace")[0]).toBe("Ace")
  })
  it("মিল না থাকলে খালি; খালি খোঁজে সব পণ্য", () => {
    expect(names(db, "zzzxq")).toEqual([])
    expect(names(db, "")).toHaveLength(4)
  })
  it("বারকোড আগের মতোই কাজ করে", () => {
    const d = createProduct(emptyDb(), { ...base, name: "X", barcode: "8901234", open: false }, NOW).db
    expect(searchProducts(d, "8901234")).toHaveLength(1)
  })
  it("ওষুধের তথ্য ছাড়া পণ্যের উপশিরোনাম খালি", () => {
    expect(productDetailLine(db.products[3]!)).toBe("")
    expect(productDetailLine(db.products[0]!)).toBe("Paracetamol 500 mg · ট্যাবলেট · Beximco")
  })
})

describe("বানান-চাবি", () => {
  it("একই ওষুধের বাংলা ও ইংরেজি বানান একই চাবি দেয়", () => {
    expect(phoneticKey("Paracetamol")).toBe(phoneticKey("প্যারাসিটামল"))
    expect(phoneticKey("Metformin")).toBe(phoneticKey("মেটফরমিন"))
    expect(phoneticKey("Napa")).toBe(phoneticKey("নাপা"))
  })
  it("আলাদা ওষুধ আলাদা চাবি দেয়", () => {
    expect(phoneticKey("Paracetamol")).not.toBe(phoneticKey("Omeprazole"))
  })
})

describe("CSV ইমপোর্ট ও সিংক", () => {
  it("নতুন কলাম থাকলে পণ্যে বসে; ধরনের নাম বাংলা/সংক্ষেপেও চলে; ভুল ধরন লাইনসহ ধরা পড়ে", () => {
    const csv = "name,price,generic,strength,form,company\nNapa,1.2,Paracetamol,500 mg,tab,Beximco\nSeclo,5,Omeprazole,20 mg,ক্যাপসুল,Square\nBad,2,,,pill,\n"
    const { ok, errors } = validateImport(parseCsv(csv), emptyDb())
    expect(ok.map((r) => r.form)).toEqual(["tablet", "capsule"])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.line).toBe(4)
    const db = importProducts(emptyDb(), ok, NOW)
    expect(db.products[0]).toMatchObject({ generic: "Paracetamol", strength: "500 mg", form: "tablet", company: "Beximco" })
  })
  it("পুরনো ফরম্যাটের ফাইল (নতুন কলাম ছাড়া) আগের মতো চলে", () => {
    const { ok, errors } = validateImport(parseCsv("name,price\nPonds,240\n"), emptyDb())
    expect(errors).toEqual([])
    const db = importProducts(emptyDb(), ok, NOW)
    expect("generic" in db.products[0]!).toBe(false)
  })
  it("নমুনা ফাইল নিজেই সঠিক", () => {
    const { errors } = validateImport(parseCsv(IMPORT_TEMPLATE_CSV), emptyDb())
    expect(errors).toEqual([])
  })
  it("ওষুধের তথ্যসহ পণ্য সিংকে অন্য ডিভাইসে পৌঁছায়", () => {
    const before = emptyDb()
    const made = createProduct(before, { ...base, name: "Napa", generic: "Paracetamol", strength: "500 mg", form: "tablet", company: "Beximco" }, NOW)
    let n = 0
    const out = eventsFromChange(before, made.db, () => `00000000-0000-4000-8000-${String(++n + 100).padStart(12, "0")}`, NOW)
    const replayed = applyEvents(emptyDb(), out.events)
    expect(replayed.ignored).toEqual([])
    expect(replayed.db.products[0]).toMatchObject({ generic: "Paracetamol", strength: "500 mg", form: "tablet", company: "Beximco" })
  })
})
