import { tf } from "../i18n"
import { DomainError, requirePositiveInt } from "./errors"
import { classifyExpiry } from "./expiry"

export interface FifoBatch {
  id: string
  expiryDate: string | null
  qtyRemaining: number
  receivedAt: string
}

export interface Allocation {
  batchId: string
  qty: number
}

/** বিক্রি করা যায় এমন ব্যাচ (মেয়াদোত্তীর্ণ বাদ), আগে মেয়াদ শেষ হওয়াটা আগে; মেয়াদ-না-থাকা সবার শেষে */
export function sellableBatches<T extends FifoBatch>(batches: readonly T[], today: string): T[] {
  return batches
    .filter((b) => b.qtyRemaining > 0 && classifyExpiry(b.expiryDate, today) !== "expired")
    .slice()
    .sort((a, b) => {
      if (a.expiryDate && b.expiryDate && a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1
      if (a.expiryDate && !b.expiryDate) return -1
      if (!a.expiryDate && b.expiryDate) return 1
      return a.receivedAt.localeCompare(b.receivedAt)
    })
}

export function allocateFifo(batches: readonly FifoBatch[], qtyNeeded: number, today: string): Allocation[] {
  requirePositiveInt(qtyNeeded, "পরিমাণ")
  const usable = sellableBatches(batches, today)
  const available = usable.reduce((s, b) => s + b.qtyRemaining, 0)
  if (available < qtyNeeded) {
    throw new DomainError("insufficient_stock", tf("স্টকে মাত্র {p0} পিস আছে", { p0: available }), { available, requested: qtyNeeded })
  }
  const out: Allocation[] = []
  let left = qtyNeeded
  for (const b of usable) {
    if (left === 0) break
    const take = Math.min(left, b.qtyRemaining)
    out.push({ batchId: b.id, qty: take })
    left -= take
  }
  return out
}
