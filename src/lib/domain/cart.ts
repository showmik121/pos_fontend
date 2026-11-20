import { tr } from "../i18n"
import { DomainError, requireNonNegativeInt, requirePositiveInt } from "./errors"

export interface PricedLine {
  unitPrice: number // পয়সা, প্রতি পিস
  qty: number // পিস
  discount: number // পয়সা, এই লাইনের মোট ছাড়
}

/** percent = শতাংশ × ১০০ (৭.৫% = ৭৫০) */
export type BillDiscount = { type: "amount"; value: number } | { type: "percent"; value: number }

export const NO_BILL_DISCOUNT: BillDiscount = { type: "amount", value: 0 }

export interface CartTotals {
  subtotal: number // ছাড়ের আগে
  lineDiscount: number
  billDiscount: number
  total: number
}

export function computeCart(lines: readonly PricedLine[], bill: BillDiscount = NO_BILL_DISCOUNT): CartTotals {
  let subtotal = 0
  let lineDiscount = 0
  for (const l of lines) {
    requireNonNegativeInt(l.unitPrice, "দাম")
    requirePositiveInt(l.qty, "পরিমাণ")
    requireNonNegativeInt(l.discount, "ছাড়")
    const gross = l.unitPrice * l.qty
    if (l.discount > gross) throw new DomainError("discount_too_large", tr("পণ্যের ছাড় তার দামের চেয়ে বেশি হতে পারে না"))
    subtotal += gross
    lineDiscount += l.discount
  }
  const base = subtotal - lineDiscount

  let billDiscount: number
  if (bill.type === "amount") {
    billDiscount = requireNonNegativeInt(bill.value, "ছাড়")
  } else {
    requireNonNegativeInt(bill.value, "ছাড়ের শতাংশ")
    if (bill.value > 10_000) throw new DomainError("invalid_percent", tr("ছাড় ১০০% এর বেশি হতে পারে না"))
    billDiscount = Math.round((base * bill.value) / 10_000)
  }
  if (billDiscount > base) throw new DomainError("discount_too_large", tr("ছাড় বিলের মোটের চেয়ে বেশি হতে পারে না"))
  return { subtotal, lineDiscount, billDiscount, total: base - billDiscount }
}

export type MobileMethod = "bkash" | "nagad" | "rocket"
export type PaymentMethod = "cash" | MobileMethod

export interface Payment {
  method: PaymentMethod
  amount: number // পয়সা
}

/**
 * নগদ + মোবাইল ব্যাংকিং থেকে কত পেলাম, কত বাকি, কত ফেরত।
 * কম দিলে বাকি হয় (কাস্টমার বাধ্যতামূলক); বেশি দিলে অতিরিক্তটা নগদ হতে হবে (ফেরত)।
 */
export function settlePayments(input: {
  total: number
  cash: number
  mobile: number
  mobileMethod: MobileMethod
  hasCustomer: boolean
}): { payments: Payment[]; paid: number; due: number; change: number } {
  const { total, cash, mobile, mobileMethod, hasCustomer } = input
  requireNonNegativeInt(total, "মোট")
  requireNonNegativeInt(cash, "নগদ")
  requireNonNegativeInt(mobile, "মোবাইল ব্যাংকিং")
  if (mobile > total) throw new DomainError("overpaid_digital", tr("মোবাইল ব্যাংকিংয়ের পরিমাণ মোটের বেশি হতে পারে না"))
  const received = cash + mobile
  const change = Math.max(0, received - total)
  if (change > cash) throw new DomainError("overpaid", tr("ফেরত দেওয়ার মতো নগদ নেই"))
  const paid = received - change
  const due = total - paid
  if (due > 0 && !hasCustomer) throw new DomainError("customer_required", tr("বাকি রাখতে কাস্টমার বেছে নিন"))
  const payments: Payment[] = []
  if (cash > 0) payments.push({ method: "cash", amount: cash })
  if (mobile > 0) payments.push({ method: mobileMethod, amount: mobile })
  return { payments, paid, due, change }
}
