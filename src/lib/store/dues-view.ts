import { tr, tf } from "../i18n"
import { daysBetween, localDateIso } from "../domain/dates"
import { formatTaka } from "../domain/money"
import { toAsciiDigits } from "../format/bn"
import { formatDateTimeBn } from "../format/datetime"
import type { DueRow } from "./selectors"
import type { LedgerEntry } from "./types"

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
  return tf("আসসালামু আলাইকুম {name}, {shop} আপনার {amount} বাকি আছে। সুবিধামতো সময়ে পরিশোধ করলে ভালো হয়। ধন্যবাদ।", { name: opts.customerName, shop: shop ? tf("{p0}-এ", { p0: shop }) : tr("দোকানে"), amount: formatTaka(opts.balance) })
}

/** sms: লিংক (Android ও iOS দুটোতেই চলে) */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`
}

export interface PromiseRow {
  row: DueRow
  date: string
  note: string
  /** ঋণাত্মক নয়: প্রতিশ্রুতির তারিখ পেরিয়ে কত দিন (আজ = ০) */
  lateDays: number
}

/** যাদের বাকি আছে ও প্রতিশ্রুতির তারিখ আজ বা পেরিয়ে গেছে (বেশি দেরি আগে) */
export function duePromises(rows: readonly DueRow[], today: string): PromiseRow[] {
  const out: PromiseRow[] = []
  for (const row of rows) {
    const p = row.customer.promise
    if (!p || p.date > today) continue
    out.push({ row, date: p.date, note: p.note, lateDays: daysBetween(p.date, today) })
  }
  return out.sort((a, b) => b.lateDays - a.lateDays)
}

/** একটি জমার পরের বাকি (ওই এন্ট্রি পর্যন্ত সব লেনদেন ধরে) */
export function balanceAfter(ledger: readonly LedgerEntry[], customerId: string, entryId: string): number {
  const mine = ledger.filter((e) => e.customerId === customerId).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  let sum = 0
  for (const e of mine) {
    sum += e.kind === "payment" || e.kind === "void" ? -e.amount : e.amount
    if (e.id === entryId) break
  }
  return sum
}

/** জমার রসিদের লেখা (শেয়ার/কপির জন্য) */
export function depositReceiptText(opts: { storeName: string; customerName: string; at: string; amount: number; balanceAfter: number }): string {
  const out = [opts.storeName.trim() || tr("জমার রসিদ"), tr("টাকা জমার রসিদ"), `${opts.customerName} · ${formatDateTimeBn(opts.at)}`, "", tf("জমা: {p0}", { p0: formatTaka(opts.amount) })]
  out.push(opts.balanceAfter > 0 ? tf("এখনো বাকি: {p0}", { p0: formatTaka(opts.balanceAfter) }) : tr("বাকি শোধ হয়েছে"), "", tr("ধন্যবাদ!"))
  return out.join("\n")
}

export interface LimitStatus {
  limit: number
  after: number
  over: boolean
}

/** এই বিলের বাকি যোগ করলে কাস্টমার সীমা ছাড়াবে কি না; সীমা না থাকলে null */
export function limitStatus(limit: number | null | undefined, balance: number, newDue: number): LimitStatus | null {
  if (limit == null) return null
  const after = balance + newDue
  return { limit, after, over: after > limit }
}
