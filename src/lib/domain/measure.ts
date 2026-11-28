import { tr } from "../i18n"
import { toAsciiDigits, toBanglaDigits } from "../format/bn"
import { formatCount } from "./money"

/**
 * কেজি/লিটারে বিক্রির পণ্য। স্টক সবসময়ের মতো পূর্ণসংখ্যায় রাখা হয়: ১ "পিস" = ০.০১ কেজি (১০ গ্রাম) বা ০.০১ লিটার (১০ মি.লি.)।
 * তাই ১ কেজি = ১০০ পিস, প্রতি-পিস দাম (পয়সা) = প্রতি কেজির দাম (পূর্ণ টাকা): ৮৫ টাকা কেজি = ৮৫ পয়সা প্রতি পিস।
 * এতে বিলের মোট (দাম × পরিমাণ) সবসময় পূর্ণ পয়সা হয়, ব্যাকএন্ড/সিংক/রিপোর্টের হিসাব বদলাতে হয় না।
 */
export type Measure = "kg" | "l"

export const MEASURES: readonly Measure[] = ["kg", "l"] as const

/** ১ কেজি/লিটারে কত পিস */
export const PIECES_PER_MEASURE = 100

export function measureName(m: Measure): string {
  return m === "kg" ? tr("কেজি") : tr("লিটার")
}

function smallName(m: Measure): string {
  return m === "kg" ? tr("গ্রাম") : tr("মি.লি.")
}

/**
 * "২.৫", "0.25", ".5" থেকে পিসে (২৫০, ২৫, ৫০)। দশমিকের পর সর্বোচ্চ ২ অঙ্ক (১০ গ্রামের ধাপ); শূন্য বা ভুল লেখা হলে null।
 */
export function parseMeasureQty(input: string): number | null {
  const s = toAsciiDigits(input).replace(/[\s,]/g, "")
  const m = /^(\d{0,6})(?:\.(\d{1,2}))?$/.exec(s)
  if (!m || (m[1] === "" && m[2] === undefined)) return null
  const pieces = Number(m[1] || "0") * PIECES_PER_MEASURE + Number((m[2] ?? "").padEnd(2, "0"))
  return pieces > 0 ? pieces : null
}

/** ইনপুট ঘরে বসানোর সংখ্যা: ২৫০ পিস → "2.5" (ইংরেজি অঙ্ক) */
export function measureInputValue(pieces: number): string {
  const whole = Math.trunc(pieces / PIECES_PER_MEASURE)
  const frac = pieces % PIECES_PER_MEASURE
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`
}

/**
 * পিস থেকে পড়ার মতো লেখা: ২৫০ → "২.৫ কেজি", ২৫ → "২৫০ গ্রাম", ১২৫ → "১.২৫ কেজি"।
 * এক কেজির কম হলে গ্রাম/মি.লি. (দোকানে যেভাবে বলে)।
 */
export function formatMeasureQty(pieces: number, m: Measure): string {
  const sign = pieces < 0 ? "−" : ""
  const abs = Math.abs(pieces)
  if (abs < PIECES_PER_MEASURE) return `${sign}${formatCount(abs * 10)} ${smallName(m)}`
  return `${sign}${toBanglaDigits(measureInputValue(abs))} ${measureName(m)}`
}

/** প্রতি-পিস দাম (পয়সা) → প্রতি কেজি/লিটারের দাম (পয়সা) */
export const perMeasurePoisha = (perPiecePoisha: number): number => perPiecePoisha * PIECES_PER_MEASURE

/**
 * প্রতি কেজি/লিটারের দাম (পয়সা) → প্রতি-পিস দাম। পূর্ণ টাকা না হলে null (নইলে পিসের দাম পূর্ণ পয়সা হয় না)।
 * `exact: false` হলে (ক্রয়মূল্যের জন্য) কাছের পয়সায় গোল করে।
 */
export function perPiecePoishaFromMeasure(perMeasure: number, exact = true): number | null {
  if (exact && perMeasure % PIECES_PER_MEASURE !== 0) return null
  return Math.round(perMeasure / PIECES_PER_MEASURE)
}

/** দ্রুত বোতামের পরিমাণ (পিসে): ২৫০ গ্রাম, ৫০০ গ্রাম, ১, ২, ৫ কেজি */
export const MEASURE_QUICK: readonly number[] = [25, 50, 100, 200, 500] as const
