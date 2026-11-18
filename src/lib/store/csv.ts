import { parseMonthYear } from "../domain/dates"
import { parseTaka } from "../domain/money"
import { toAsciiDigits } from "../format/bn"
import { findByBarcode } from "./selectors"
import type { Db, UnitLabel } from "./types"

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

export const IMPORT_HEADERS = ["barcode", "name", "cost", "price", "unit", "carton_size", "min_stock", "category", "batch", "expiry", "qty"] as const

export const IMPORT_TEMPLATE_CSV = `${IMPORT_HEADERS.join(",")}\n8901234567890,পন্ডস ক্রিম ১০০ মি.লি.,200,240,piece,10,5,স্কিন কেয়ার,B2407,06/2027,30\n`

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
}

export interface ImportRowError {
  line: number
  message: string
}

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

    ok.push({ line, barcode, name, costPoisha: cost, pricePoisha: price, unit, cartonSize: carton, minStock: min, category: get(r, "category"), batchNo: get(r, "batch"), expiryDate: expiry, qty })
  })
  return { ok, errors }
}
