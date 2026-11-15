import { toAsciiDigits, toBanglaDigits } from "./bn"

/**
 * বাংলাদেশের মোবাইল নম্বরকে 01XXXXXXXXX আকারে আনে (ব্যাকএন্ডের নিয়মের সমান)।
 * +880 / 880 / বাংলা অঙ্ক / স্পেস-হাইফেন মানে। ভুল হলে null।
 */
export function normalizeBdPhone(input: string): string | null {
  let s = toAsciiDigits(input).replace(/[\s-]/g, "")
  if (s.startsWith("+880")) s = "0" + s.slice(4)
  else if (s.startsWith("880") && s.length === 13) s = "0" + s.slice(3)
  return /^01[3-9]\d{8}$/.test(s) ? s : null
}

export function formatPhoneBn(phone: string): string {
  return toBanglaDigits(phone)
}
