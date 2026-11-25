import { tr } from "../i18n"
import { DomainError, requirePositiveInt } from "./errors"

export type StockUnit = "piece" | "carton"

// স্টক সবসময় পিসে। কার্টনে কেনা হলে packSize দিয়ে পিসে বদলে নিতে হয়।
export function toBaseUnits(input: { qty: number; unit: StockUnit; packSize: number }): number {
  const { qty, unit, packSize } = input
  requirePositiveInt(qty, "পরিমাণ")
  if (unit === "piece") return qty
  requirePositiveInt(packSize, "কার্টনে পিসের সংখ্যা")
  if (packSize === 1) throw new DomainError("no_carton", tr("এই পণ্যের কার্টন সাইজ ঠিক করা নেই"))
  return qty * packSize
}

/** ২৫ পিস, কার্টন ১০ → { cartons: 2, pieces: 5 } */
export function splitCartons(totalPieces: number, packSize: number): { cartons: number; pieces: number } {
  requirePositiveInt(packSize, "কার্টনে পিসের সংখ্যা")
  return { cartons: Math.floor(totalPieces / packSize), pieces: totalPieces % packSize }
}

/** স্টক-জমায় গোনার একক: পিস, পাতা (stripSize পিস) বা কার্টন/বক্স (cartonSize পিস) */
export type CountUnit = "piece" | "strip" | "carton"

/** পিস/পাতা/কার্টন থেকে পিসে (স্টক সবসময় পিসে)। পাতা বা কার্টনের মাপ ঠিক না থাকলে বাংলা বার্তাসহ ত্রুটি। */
export function toPieces(input: { qty: number; unit: CountUnit; stripSize: number; cartonSize: number }): number {
  const { qty, unit, stripSize, cartonSize } = input
  if (unit !== "strip") return toBaseUnits({ qty, unit, packSize: cartonSize })
  requirePositiveInt(qty, "পরিমাণ")
  requirePositiveInt(stripSize, "পাতায় পিসের সংখ্যা")
  if (stripSize === 1) throw new DomainError("no_strip", tr("এই পণ্যের পাতার সাইজ ঠিক করা নেই"))
  return qty * stripSize
}

/** ২৫৭ পিস, পাতা ১০, বক্স ১০০ → { boxes: 2, strips: 5, pieces: 7 }। মাপ ১ বা তার কম হলে ওই ধাপ বাদ (০) */
export function packBreakdown(totalPieces: number, stripSize: number, cartonSize: number): { boxes: number; strips: number; pieces: number } {
  let rest = Math.max(0, Math.trunc(totalPieces))
  const boxes = cartonSize > 1 ? Math.floor(rest / cartonSize) : 0
  rest -= boxes * cartonSize
  const strips = stripSize > 1 ? Math.floor(rest / stripSize) : 0
  rest -= strips * stripSize
  return { boxes, strips, pieces: rest }
}
