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
