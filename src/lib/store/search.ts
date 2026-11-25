import { tr } from "../i18n"
import { toAsciiDigits } from "../format/bn"
import { phoneticKey } from "./phonetic"
import { DOSAGE_FORMS, type Db, type Product } from "./types"

/** যে লেখাগুলোতে খোঁজা হয়: নাম, জেনেরিক, শক্তি, ধরন, কোম্পানি, ক্যাটেগরি */
function searchableText(p: Product): string {
  return [p.name, p.generic, p.strength, p.form ? DOSAGE_FORMS[p.form] : "", p.form, p.company, p.category].filter(Boolean).join(" ").toLowerCase()
}

const tokenize = (s: string) => s.split(/[^\p{L}\p{M}\p{N}.]+/u).filter(Boolean)

/** একটি শব্দ লেখাটিতে সরাসরি (0), বানান-মিলে (1), বা একেবারেই না (-1) মেলে */
function tokenMatch(text: string, words: string[], token: string): 0 | 1 | -1 {
  if (text.includes(token)) return 0
  if (!/[\p{L}]/u.test(token)) return -1
  const key = phoneticKey(token)
  if (key.length < 2) return -1
  // ছোট চাবি (২ অক্ষর) পুরো শব্দের সাথে মিললে, লম্বা চাবি শব্দের যেকোনো অংশে মিললে
  for (const w of words) {
    const wk = phoneticKey(w)
    if (key.length >= 3 ? wk.includes(key) : wk === key) return 1
  }
  return -1
}

/**
 * নাম, জেনেরিক, শক্তি, ধরন, কোম্পানি, ক্যাটেগরি বা বারকোড মিললে পণ্য ফেরত দেয়।
 * বাংলা/ইংরেজি বানান যেকোনোটাতে চলে (প্যারাসিটামল ↔ Paracetamol)। একাধিক শব্দ দিলে সবকটি মিলতে হবে ("napa 500")।
 * সরাসরি মিল আগে, বানান-মিল পরে; খালি খোঁজে সব পণ্য (নাম অনুযায়ী সাজানো)।
 */
export function searchProducts(db: Db, query: string): Product[] {
  const q = toAsciiDigits(query).trim().toLowerCase()
  const sorted = [...db.products].sort((a, b) => a.name.localeCompare(b.name, "bn"))
  if (!q) return sorted
  const tokens = tokenize(q)
  if (tokens.length === 0) return sorted
  const hits: Array<{ p: Product; rank: number }> = []
  for (const p of sorted) {
    if (p.barcodes.some((b) => b.code.includes(q))) {
      hits.push({ p, rank: 0 })
      continue
    }
    const text = searchableText(p)
    const words = tokenize(text)
    let rank = 0
    let all = true
    for (const t of tokens) {
      const m = tokenMatch(text, words, t)
      if (m < 0) {
        all = false
        break
      }
      if (m > rank) rank = m
    }
    if (all) hits.push({ p, rank: rank === 0 && p.name.toLowerCase().startsWith(q) ? -1 : rank })
  }
  // sort() স্থিতিশীল, তাই একই র‍্যাঙ্কে নামের ক্রম থাকে
  return hits.sort((a, b) => a.rank - b.rank).map((h) => h.p)
}

/** তালিকার উপশিরোনামে দেখানোর জন্য: "Paracetamol 500 mg · ট্যাবলেট · Square"; কিছু না থাকলে খালি */
export function productDetailLine(p: Product): string {
  return [[p.generic, p.strength].filter(Boolean).join(" "), p.form ? tr(DOSAGE_FORMS[p.form]) : "", p.company].filter(Boolean).join(" · ")
}
