import { packBreakdown } from "../domain/units"
import { formatCount } from "../domain/money"
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

/** তালিকার "স্টক …" লেখা: পাতার মাপ থাকলে ভাঙা রূপ (২৫ পাতা ৭ পিস), নইলে শুধু সংখ্যা (আগের মতো) */
export function stockCountText(product: Pick<Product, "stripSize" | "cartonSize">, qty: number): string {
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
