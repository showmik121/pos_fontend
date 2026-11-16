import { daysBetween } from "./dates"

export type ExpiryClass = "none" | "expired" | "critical" | "soon" | "ok"

/** আজ থেকে মেয়াদ শেষ হতে কত দিন বাকি (শেষ হয়ে গেলে ঋণাত্মক) */
export function daysUntil(expiryDate: string, today: string): number {
  return daysBetween(today, expiryDate)
}

// expired = আজ বা তার আগে শেষ (বিক্রি বন্ধ); critical ≤ ৩০ দিন; soon ≤ ৯০ দিন; ok; none = মেয়াদ নেই
export function classifyExpiry(expiryDate: string | null | undefined, today: string): ExpiryClass {
  if (expiryDate == null) return "none"
  const d = daysUntil(expiryDate, today)
  if (d <= 0) return "expired"
  if (d <= 30) return "critical"
  if (d <= 90) return "soon"
  return "ok"
}
