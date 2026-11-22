import { addDays } from "../domain/dates"
import { saleDate } from "./selectors"
import type { Db } from "./types"

/** হোমের ছোট চার্টে কত দিন */
export const TREND_DAYS = 7

/** শেষ `days` দিনের (আজসহ) বিক্রির মোট, পুরনো থেকে আজ; বাতিল বিল বাদ। বিলগুলো একবারই ঘোরে */
export function dailyTotals(db: Db, today: string, days: number = TREND_DAYS): number[] {
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)))
  const totals = new Map<string, number>(dates.map((d) => [d, 0]))
  for (const s of db.sales) {
    if (s.voided) continue
    const d = saleDate(s)
    const prev = totals.get(d)
    if (prev !== undefined) totals.set(d, prev + s.total)
  }
  return dates.map((d) => totals.get(d) ?? 0)
}

/** আগের মানের তুলনায় শতাংশ বদল (পূর্ণসংখ্যা); আগের মান শূন্য হলে তুলনা চলে না, null */
export function changePercent(current: number, before: number): number | null {
  if (before <= 0) return null
  return Math.round(((current - before) / before) * 100)
}
