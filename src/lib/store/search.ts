import { toAsciiDigits } from "../format/bn"
import type { Db, Product } from "./types"

/** নাম, ক্যাটেগরি বা বারকোড মিললে পণ্য ফেরত দেয়; খালি খোঁজে সব পণ্য (নাম অনুযায়ী সাজানো)। */
export function searchProducts(db: Db, query: string): Product[] {
  const q = toAsciiDigits(query).trim().toLowerCase()
  const sorted = [...db.products].sort((a, b) => a.name.localeCompare(b.name, "bn"))
  if (!q) return sorted
  return sorted.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.barcodes.some((b) => b.code.includes(q)))
}
