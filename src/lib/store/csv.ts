import { parseMonthYear } from "../domain/dates"
import { parseTaka } from "../domain/money"
import { toAsciiDigits } from "../format/bn"
import { findByBarcode } from "./selectors"
import { DOSAGE_FORMS, PHARMA_TEXT_MAX, type Db, type DosageForm, type UnitLabel } from "./types"

// Excel থেকে "CSV UTF-8" হিসেবে সেভ করা ফাইল পড়ার জন্য। কোটেশন, কমা, নতুন লাইন সামলায়।
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

/** এর বেশি বড় ফাইল/সারি নিলে ফোন আটকে যায় ও স্টোরেজ ভরে; তাই আগেই ফেরত */
export const MAX_IMPORT_BYTES = 1_000_000
export const MAX_IMPORT_ROWS = 5000

export const IMPORT_HEADERS = ["barcode", "name", "cost", "price", "unit", "carton_size", "min_stock", "category", "batch", "expiry", "qty", "generic", "strength", "form", "company", "strip_size"] as const

export const IMPORT_TEMPLATE_CSV = `${IMPORT_HEADERS.join(",")}\n8901234567890,পন্ডস ক্রিম ১০০ মি.লি.,200,240,piece,10,5,স্কিন কেয়ার,B2407,06/2027,30,,,,,\n8901234567891,Napa,0.12,0.12,piece,100,500,ওষুধ,B1,06/2027,1000,Paracetamol,500 mg,tablet,Beximco,10\n`

export interface ImportRow {
  line: number
  barcode: string
  name: string
  costPoisha: number
  pricePoisha: number
  unit: UnitLabel
  cartonSize: number
  minStock: number
  category: string
  batchNo: string
  expiryDate: string | null
  qty: number
  generic?: string
  strength?: string
  form?: DosageForm
  company?: string
  stripSize?: number
}

export interface ImportRowError {
  line: number
  message: string
}

const FORM_ALIASES: Record<string, DosageForm> = {
  tablet: "tablet", tab: "tablet", capsule: "capsule", cap: "capsule", syrup: "syrup", suspension: "syrup", injection: "injection", inj: "injection",
  drop: "drop", drops: "drop", cream: "cream", ointment: "cream", gel: "cream", inhaler: "inhaler", saline: "saline", powder: "saline", other: "other",
}
for (const [key, label] of Object.entries(DOSAGE_FORMS)) FORM_ALIASES[label.toLowerCase()] = key as DosageForm

const UNIT_ALIASES: Record<string, UnitLabel> = { piece: "piece", pcs: "piece", "পিস": "piece", strip: "strip", "পাতা": "strip", box: "box", "বক্স": "box" }

function toInt(s: string): number | null {
  const t = toAsciiDigits(s).replace(/[,\s]/g, "")
  return /^\d+$/.test(t) ? Number(t) : null
}

export function validateImport(csvRows: string[][], db: Db): { ok: ImportRow[]; errors: ImportRowError[] } {
  const ok: ImportRow[] = []
  const errors: ImportRowError[] = []
  const [header, ...body] = csvRows
  if (!header) return { ok, errors: [{ line: 1, message: "ফাইল ফাঁকা" }] }
  if (body.length > MAX_IMPORT_ROWS) return { ok, errors: [{ line: 1, message: `একবারে সর্বোচ্চ ${MAX_IMPORT_ROWS} টি পণ্য আনা যায়; ফাইল ভাগ করে আবার দিন` }] }
  const idx = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]))
  if (!idx.has("name") || !idx.has("price")) {
    return { ok, errors: [{ line: 1, message: "প্রথম সারিতে name ও price কলাম থাকতে হবে (নমুনা ফাইল দেখুন)" }] }
  }
  const get = (r: string[], k: string): string => (r[idx.get(k) ?? -1] ?? "").trim()
  const seen = new Set<string>()

  body.forEach((r, i) => {
    const line = i + 2
    const fail = (message: string) => errors.push({ line, message })
    const name = get(r, "name")
    if (!name) return fail("নাম ফাঁকা")
    const priceText = get(r, "price")
    if (!priceText) return fail("বিক্রয়মূল্য ফাঁকা")
    const price = parseTaka(priceText)
    if (price == null || price <= 0) return fail("বিক্রয়মূল্য সঠিক নয়")
    const costText = get(r, "cost")
    const cost = costText ? parseTaka(costText) : 0
    if (cost == null) return fail("ক্রয়মূল্য সঠিক নয়")

    const barcode = toAsciiDigits(get(r, "barcode"))
    if (barcode) {
      if (seen.has(barcode) || findByBarcode(db, barcode)) return fail("বারকোড আগে থেকেই আছে")
      seen.add(barcode)
    }
    const unitText = get(r, "unit").toLowerCase()
    const unit = unitText ? (Object.prototype.hasOwnProperty.call(UNIT_ALIASES, unitText) ? UNIT_ALIASES[unitText] : undefined) : "piece"
    if (!unit) return fail("একক হবে piece / strip / box")
    const cartonText = get(r, "carton_size")
    const carton = cartonText ? toInt(cartonText) : 1
    if (carton == null || carton < 1) return fail("কার্টন সাইজ সঠিক নয়")
    const minText = get(r, "min_stock")
    const min = minText ? toInt(minText) : db.settings.defaultMinStock
    if (min == null) return fail("সর্বনিম্ন স্টক সঠিক নয়")
    const expiryText = get(r, "expiry")
    const expiry = expiryText ? parseMonthYear(expiryText) : null
    if (expiryText && !expiry) return fail("মেয়াদের ফরম্যাট ভুল (মাস/বছর, যেমন 06/2027)")
    const qtyText = get(r, "qty")
    const qty = qtyText ? toInt(qtyText) : 0
    if (qty == null) return fail("পরিমাণ সঠিক নয়")

    const generic = get(r, "generic")
    const strength = get(r, "strength")
    const company = get(r, "company")
    if (generic.length > PHARMA_TEXT_MAX.generic || strength.length > PHARMA_TEXT_MAX.strength || company.length > PHARMA_TEXT_MAX.company) return fail("জেনেরিক/শক্তি/কোম্পানির লেখা বেশি লম্বা")
    const stripText = get(r, "strip_size")
    const stripSize = stripText ? toInt(stripText) : undefined
    if (stripText && (stripSize == null || stripSize < 1)) return fail("পাতার সাইজ (strip_size) সঠিক নয়")
    const formText = get(r, "form").toLowerCase()
    const form = formText ? (Object.prototype.hasOwnProperty.call(FORM_ALIASES, formText) ? FORM_ALIASES[formText] : undefined) : undefined
    if (formText && !form) return fail("ধরন হবে tablet / capsule / syrup / injection / drop / cream / inhaler / saline / other")

    ok.push({ line, barcode, name, costPoisha: cost, pricePoisha: price, unit, cartonSize: carton, minStock: min, category: get(r, "category"), batchNo: get(r, "batch"), expiryDate: expiry, qty, generic, strength, form, company, stripSize: stripSize && stripSize > 1 ? stripSize : undefined })
  })
  return { ok, errors }
}
