import { toAsciiDigits } from "../format/bn"

/** পরিমাণের ঘরে ১০০০০০-এর বেশি ওঠে না (ভুল ট্যাপে বিশাল সংখ্যা আটকায়) */
export const QTY_INPUT_MAX = 100_000

/** পরিমাণের ঘরের লেখা (বাংলা/ইংরেজি অঙ্ক বা খালি) + delta, ইংরেজি অঙ্কের লেখা হিসেবে ফেরত। */
export function addToQty(current: string, delta: number): string {
  const base = Number(toAsciiDigits(current).replace(/\D/g, "")) || 0
  return String(Math.min(base + delta, QTY_INPUT_MAX))
}
