import { toAsciiDigits, toBanglaDigits } from "../format/bn"
import { DomainError } from "./errors"

const DAY_MS = 86_400_000
export const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"] as const

/** ডিভাইসের স্থানীয় তারিখ YYYY-MM-DD আকারে */
export function localDateIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function todayIso(now: Date = new Date()): string {
  return localDateIso(now)
}

function parseIso(s: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new DomainError("invalid_date", "তারিখ YYYY-MM-DD আকারে হতে হবে")
  const t = Date.parse(`${s}T00:00:00Z`)
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) {
    throw new DomainError("invalid_date", "তারিখ সঠিক নয়")
  }
  return t
}

/** a থেকে b পর্যন্ত কত দিন (b পরে হলে ধনাত্মক) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b) - parseIso(a)) / DAY_MS)
}

export function addDays(iso: string, days: number): string {
  return new Date(parseIso(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

/** "১২ নভেম্বর ২০২৬" */
export function formatDateBn(iso: string): string {
  const [y = "", m = "1", d = "1"] = iso.split("-")
  return toBanglaDigits(`${Number(d)} ${BN_MONTHS[Number(m) - 1] ?? ""} ${y}`)
}

/** "১২ নভেম্বর" */
export function formatDayMonthBn(iso: string): string {
  const [, m = "1", d = "1"] = iso.split("-")
  return toBanglaDigits(`${Number(d)} ${BN_MONTHS[Number(m) - 1] ?? ""}`)
}

/** মেয়াদ "06/2027" বা "০৬/২০২৭" লেখাকে মাসের শেষ তারিখে (YYYY-MM-DD) বদলায়। ভুল হলে null। */
export function parseMonthYear(input: string): string | null {
  const m = /^(\d{1,2})\s*[/-]\s*(\d{4})$/.exec(toAsciiDigits(input).trim())
  if (!m) return null
  const month = Number(m[1])
  const year = Number(m[2])
  if (month < 1 || month > 12 || year < 2000 || year > 2099) return null
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`
}

/** "2027-06-30" → "০৬/২০২৭" */
export function formatMonthYear(iso: string): string {
  const [y = "", m = ""] = iso.split("-")
  return toBanglaDigits(`${m}/${y}`)
}
