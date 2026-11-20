import { daysBetween, localDateIso } from "../domain/dates"
import { formatTaka } from "../domain/money"
import { toAsciiDigits } from "../format/bn"
import type { DueRow } from "./selectors"

/** এত দিন কোনো লেনদেন না থাকলে বাকিকে "পুরনো" ধরা হয় */
export const OLD_DUE_DAYS = 30

export type DueSort = "amount" | "oldest" | "name"
export type DueFilter = "all" | "old"

/** শেষ লেনদেনের পর কত দিন গেছে (আজ = ০) */
export function daysSince(iso: string, now: Date): number {
  return Math.max(0, daysBetween(localDateIso(new Date(iso)), localDateIso(now)))
}

export function isOldDue(row: DueRow, now: Date): boolean {
  return daysSince(row.lastAt, now) >= OLD_DUE_DAYS
}

/** খোঁজা, ফিল্টার ও বাছাই; মূল তালিকা বদলায় না */
export function viewDueRows(rows: readonly DueRow[], opts: { query: string; filter: DueFilter; sort: DueSort; now: Date }): DueRow[] {
  const q = toAsciiDigits(opts.query).trim().toLowerCase()
  const out = rows.filter((r) => {
    if (q && !r.customer.name.toLowerCase().includes(q) && !r.customer.phone.includes(q)) return false
    return opts.filter === "all" || isOldDue(r, opts.now)
  })
  const cmp: Record<DueSort, (a: DueRow, b: DueRow) => number> = {
    amount: (a, b) => b.balance - a.balance,
    oldest: (a, b) => (a.lastAt < b.lastAt ? -1 : a.lastAt > b.lastAt ? 1 : 0),
    name: (a, b) => a.customer.name.localeCompare(b.customer.name, "bn"),
  }
  return [...out].sort(cmp[opts.sort])
}

export interface DueSummary {
  total: number
  count: number
  oldTotal: number
  oldCount: number
}

export function summarizeDues(rows: readonly DueRow[], now: Date): DueSummary {
  let total = 0
  let oldTotal = 0
  let oldCount = 0
  for (const r of rows) {
    total += r.balance
    if (isOldDue(r, now)) {
      oldTotal += r.balance
      oldCount += 1
    }
  }
  return { total, count: rows.length, oldTotal, oldCount }
}

/** তাগাদার এসএমএসের লেখা (ভদ্র ভাষায়, দোকানের নামসহ) */
export function reminderText(opts: { customerName: string; balance: number; storeName: string }): string {
  const shop = opts.storeName.trim()
  return `আসসালামু আলাইকুম ${opts.customerName}, ${shop ? `${shop}-এ` : "দোকানে"} আপনার ${formatTaka(opts.balance)} বাকি আছে। সুবিধামতো সময়ে পরিশোধ করলে ভালো হয়। ধন্যবাদ।`
}

/** sms: লিংক (Android ও iOS দুটোতেই চলে) */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`
}
