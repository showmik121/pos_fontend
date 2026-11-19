import { formatDateBn, localDateIso } from "../domain/dates"
import { toBanglaDigits } from "./bn"

function dayPart(hour: number): string {
  if (hour >= 4 && hour < 12) return "সকাল"
  if (hour >= 12 && hour < 16) return "দুপুর"
  if (hour >= 16 && hour < 18) return "বিকাল"
  if (hour >= 18 && hour < 20) return "সন্ধ্যা"
  return "রাত"
}

/** "শুভ সকাল" … "শুভ রাত্রি" (ঘণ্টা ০–২৩) */
export function greetingBn(hour: number): string {
  const part = dayPart(hour)
  return part === "রাত" ? "শুভ রাত্রি" : `শুভ ${part}`
}

/** "দুপুর ২:৩০" */
export function formatTimeBn(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${dayPart(h)} ${toBanglaDigits(h12)}:${toBanglaDigits(String(d.getMinutes()).padStart(2, "0"))}`
}

/** "১২ নভেম্বর ২০২৬, দুপুর ২:৩০" */
export function formatDateTimeBn(iso: string): string {
  return `${formatDateBn(localDateIso(new Date(iso)))}, ${formatTimeBn(iso)}`
}
