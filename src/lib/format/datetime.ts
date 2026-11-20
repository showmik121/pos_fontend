import { tr, tf } from "../i18n"
import { formatDateBn, localDateIso } from "../domain/dates"
import { toBanglaDigits } from "./bn"

function dayPart(hour: number): string {
  if (hour >= 4 && hour < 12) return tr("সকাল")
  if (hour >= 12 && hour < 16) return tr("দুপুর")
  if (hour >= 16 && hour < 18) return tr("বিকাল")
  if (hour >= 18 && hour < 20) return tr("সন্ধ্যা")
  return tr("রাত")
}

/** "শুভ সকাল" … "শুভ রাত্রি" (ঘণ্টা ০–২৩) */
export function greetingBn(hour: number): string {
  const part = dayPart(hour)
  return part === tr("রাত") ? tr("শুভ রাত্রি") : tf("শুভ {p0}", { p0: part })
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
