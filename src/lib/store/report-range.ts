import { addDays, daysBetween } from "@/lib/domain/dates"
import { monthRange } from "./expenses"

export type ReportPreset = "today" | "yesterday" | "week" | "month" | "day"

export interface ReportRange {
  from: string
  to: string
  /** ঠিক আগের সমান দৈর্ঘ্যের সময় (তুলনার জন্য) */
  prevFrom: string
  prevTo: string
}

/** রিপোর্টের সময়: আজ / গতকাল / শেষ ৭ দিন / এই মাস (১ তারিখ থেকে আজ) / বেছে নেওয়া একটি দিন */
export function reportRange(preset: ReportPreset, today: string, day: string = today): ReportRange {
  let from = today
  let to = today
  if (preset === "yesterday") from = to = addDays(today, -1)
  else if (preset === "week") from = addDays(today, -6)
  else if (preset === "month") from = monthRange(today)[0]
  else if (preset === "day") from = to = day
  const len = daysBetween(from, to) + 1
  const prevTo = addDays(from, -1)
  return { from, to, prevFrom: addDays(prevTo, -(len - 1)), prevTo }
}

/** আগের সময়ের তুলনায় শতকরা বদল (পূর্ণসংখ্যা); আগের মান ০ বা কম হলে null (তুলনা অর্থহীন) */
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
