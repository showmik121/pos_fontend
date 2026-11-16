import { toAsciiDigits, toBanglaDigits } from "../format/bn"

// টাকার হিসাব ভেতরে সবসময় পয়সা (পূর্ণসংখ্যা): ৳২৪০.৫০ = ২৪০৫০। দশমিকের ভুল এড়াতে।

/** "২৪০", "১,২০০.৫" ইত্যাদি লেখাকে পয়সায় বদলায়। ভুল হলে null। */
export function parseTaka(input: string): number | null {
  const s = toAsciiDigits(input).replace(/[,\s৳]/g, "")
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null
  const [whole = "0", frac = ""] = s.split(".")
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"))
}

const GROUPING = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/** পূর্ণ সংখ্যাকে বাংলা অঙ্কে, বাংলাদেশি কমা-সহ: ১২,৪৫০ বা ১,০০,০০০ */
export function formatCount(n: number): string {
  return toBanglaDigits(GROUPING.format(n))
}

/** পয়সা থেকে "৳ ১২,৪৫০" (পয়সা থাকলে ".৫০" সহ)। */
export function formatTaka(poisha: number): string {
  const sign = poisha < 0 ? "−" : ""
  const abs = Math.abs(poisha)
  const whole = Math.trunc(abs / 100)
  const frac = abs % 100
  const fracText = frac === 0 ? "" : `.${toBanglaDigits(String(frac).padStart(2, "0"))}`
  return `${sign}৳ ${formatCount(whole)}${fracText}`
}

/** ইনপুট ঘরে দেখানোর জন্য (৳ ছাড়া, কমা ছাড়া): ২৪০ বা ২৪০.৫ */
export function takaInputValue(poisha: number): string {
  const whole = Math.trunc(poisha / 100)
  const frac = poisha % 100
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`
}
