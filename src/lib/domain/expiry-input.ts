import { toAsciiDigits } from "../format/bn"

/** মেয়াদের ঘরে লেখার সময়: শুধু অঙ্ক রাখে, মাসের পর নিজে "/" বসায় ("062027" → "06/2027")। মাসের প্রথম অঙ্ক ২–৯ হলে শূন্য বসায়। */
export function formatExpiryInput(raw: string): string {
  let digits = toAsciiDigits(raw).replace(/\D/g, "").slice(0, 6)
  if (digits.length === 1 && Number(digits) > 1) digits = `0${digits}`
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

/** জমা দেওয়ার আগে: দুই অঙ্কের বছর ("06/27") পূর্ণ বছর ("06/2027") হয়, এক অঙ্কের মাসে শূন্য বসে। অন্য কিছু যেমন আছে তেমন। */
export function normalizeExpiryInput(raw: string): string {
  const m = /^(\d{1,2})\s*[/-]\s*(\d{2})$/.exec(toAsciiDigits(raw).trim())
  if (!m) return raw.trim()
  return `${(m[1] ?? "").padStart(2, "0")}/20${m[2]}`
}
