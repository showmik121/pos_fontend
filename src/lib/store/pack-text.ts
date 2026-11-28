import { formatMeasureQty, measureName, perMeasurePoisha, type Measure } from "../domain/measure"
import { toBanglaDigits } from "../format/bn"
import { packBreakdown } from "../domain/units"
import { formatCount, formatTaka } from "../domain/money"
import { tf, tr } from "../i18n"
import type { Product } from "./types"

/** পাতার মাপ ঠিক করা আছে কি */
export const hasStrips = (p: Pick<Product, "stripSize">): boolean => (p.stripSize ?? 1) > 1

/**
 * পরিমাণ (পিসে) বাক্স/পাতা/পিসে ভেঙে লেখে: "২ বক্স ৫ পাতা ৭ পিস"। শূন্য ধাপ বাদ; সবই শূন্য হলে "০ পিস"।
 */
export function packText(totalPieces: number, product: Pick<Product, "stripSize" | "cartonSize">): string {
  const { boxes, strips, pieces } = packBreakdown(totalPieces, product.stripSize ?? 1, product.cartonSize)
  const parts: string[] = []
  if (boxes > 0) parts.push(`${formatCount(boxes)} ${tr("বক্স")}`)
  if (strips > 0) parts.push(`${formatCount(strips)} ${tr("পাতা")}`)
  if (pieces > 0 || parts.length === 0) parts.push(`${formatCount(pieces)} ${tr("পিস")}`)
  return parts.join(" ")
}

/** তালিকার "স্টক …" লেখা: কেজি/লিটারের পণ্যে "২.৫ কেজি"; পাতার মাপ থাকলে ভাঙা রূপ (২৫ পাতা ৭ পিস), নইলে শুধু সংখ্যা (আগের মতো) */
export function stockCountText(product: Pick<Product, "stripSize" | "cartonSize" | "measure">, qty: number): string {
  if (product.measure) return formatMeasureQty(qty, product.measure)
  return hasStrips(product) ? packText(qty, { stripSize: product.stripSize, cartonSize: 1 }) : formatCount(qty)
}

/** একবারে যোগ করার দ্রুত বোতাম: কয়েক পিস (পাতা কেটে) বা এক/দুই পাতা। `onAdd` পিসে সংখ্যা পায়। */
export function packChoices(product: Pick<Product, "stripSize">, includeOne: boolean): Array<{ qty: number; label: string }> {
  const strip = product.stripSize ?? 1
  if (strip <= 1) return []
  const out: Array<{ qty: number; label: string }> = []
  for (const n of includeOne ? [1, 2, 5] : [2, 5]) if (n < strip) out.push({ qty: n, label: tf("{p0} পিস", { p0: formatCount(n) }) })
  out.push({ qty: strip, label: tf("১ পাতা ({p0} পিস)", { p0: formatCount(strip) }) })
  out.push({ qty: strip * 2, label: tf("২ পাতা ({p0} পিস)", { p0: formatCount(strip * 2) }) })
  return out
}

/** "স্টক …" লেখা একক সহ: "২.৫ কেজি" বা "২৫০ পিস" (ভ্যারিয়েন্টের মোট স্টকের মতো জায়গায়) */
export function stockWithUnit(product: Pick<Product, "measure">, qty: number): string {
  return product.measure ? formatMeasureQty(qty, product.measure) : `${formatCount(qty)} ${tr("পিস")}`
}

/** দামের লেখা: কেজি/লিটারে "৳ ৮৫/কেজি", নইলে প্রতি-পিস দাম। `pricePoisha` না দিলে পণ্যের তালিকা-দাম */
export function priceText(product: Pick<Product, "measure" | "pricePoisha">, pricePoisha: number = product.pricePoisha): string {
  return product.measure ? `${formatTaka(perMeasurePoisha(pricePoisha))}/${measureName(product.measure)}` : formatTaka(pricePoisha)
}

/** বিলের লাইনের "দাম × পরিমাণ" লেখা: কেজি/লিটারে "৳ ৮৫/কেজি × ২.৫ কেজি", নইলে "৳ ৪০ × ৩" */
export function lineQtyText(measure: Measure | undefined, unitPrice: number, qty: number): string {
  if (!measure) return `${formatTaka(unitPrice)} × ${toBanglaDigits(qty)}`
  return `${priceText({ measure, pricePoisha: unitPrice })} × ${formatMeasureQty(qty, measure)}`
}

/** বিক্রির পরিমাণ লেখা (রিপোর্টে): "২.৫ কেজি বিক্রি" বা "১২ পিস বিক্রি" */
export function soldText(measure: Measure | undefined, qty: number): string {
  return measure ? tf("{p0} বিক্রি", { p0: formatMeasureQty(qty, measure) }) : tf("{p0} পিস বিক্রি", { p0: formatCount(qty) })
}
