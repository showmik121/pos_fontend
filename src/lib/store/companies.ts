import type { Db } from "./types"

/** বাংলাদেশের পরিচিত ওষুধ কোম্পানি (ড্রপডাউনে দেখানোর জন্য); তালিকায় না থাকলে "অন্য" বেছে নিজে লেখা যায় */
export const COMMON_COMPANIES = [
  "Square",
  "Beximco",
  "Incepta",
  "Renata",
  "Eskayef",
  "Opsonin",
  "ACI",
  "Aristopharma",
  "Acme",
  "Healthcare",
  "Drug International",
  "Popular",
  "Ibn Sina",
  "Radiant",
  "Sanofi",
  "Novartis",
  "GSK",
  "Pfizer",
  "Orion",
  "Navana",
  "Jayson",
  "Delta",
  "Beacon",
  "General",
  "Techno Drugs",
  "Ziska",
  "Albion",
  "Edruc",
  "Nuvista",
  "Mystic",
  "Sun Pharma",
  "Cipla",
] as const

/**
 * ড্রপডাউনের তালিকা: দোকানের পণ্যে আগে ব্যবহার হওয়া কোম্পানি আগে (বর্ণানুক্রমে), তারপর পরিচিত কোম্পানি;
 * বড়-ছোট হাতের অক্ষরের তফাতে দুবার আসে না। `current` তালিকায় না থাকলেও যোগ হয় (সম্পাদনায় হারায় না)।
 */
export function companyOptions(db: Pick<Db, "products">, current = ""): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (name: string) => {
    const t = name.trim()
    const key = t.toLowerCase()
    if (!t || seen.has(key)) return
    seen.add(key)
    out.push(t)
  }
  const used = [...new Set(db.products.map((p) => p.company?.trim() ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b))
  for (const c of used) add(c)
  for (const c of COMMON_COMPANIES) add(c)
  add(current)
  return out
}
