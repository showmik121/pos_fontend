import { parseTaka } from "./money"
import type { MobileMethod } from "./cart"

/** পেমেন্ট পাতার বাছাই: ক্যাশ বা একটি মোবাইল মাধ্যম */
export type PayMethod = "cash" | MobileMethod

/** নতুন বিলে বেছে নেওয়ার মাধ্যম (রকেট নয়; পুরনো বিলের রকেট শুধু রসিদ/রিপোর্টে দেখা যায়) */
export const PAY_METHODS = ["cash", "bkash", "nagad"] as const satisfies readonly PayMethod[]

export interface EntryInput {
  mode: "single" | "split"
  /** একক মোডে বাছা মাধ্যম */
  method: PayMethod
  /** একক মোডের টাকার ঘর; null = ছোঁয়া হয়নি, পুরো মোট */
  amount: string | null
  /** ভাগ মোডের ক্যাশ ঘর; null = ছোঁয়া হয়নি, মোটের বাকি অংশ */
  cashInput: string | null
  /** ভাগ মোডের মোবাইল ঘর */
  mobileInput: string
  /** ভাগ মোডে মোবাইলের মাধ্যম */
  splitMethod: MobileMethod
  /** পয়সায় */
  total: number
}

export type EntryResult = { ok: true; cash: number; mobile: number; mobileMethod: MobileMethod } | { ok: false }

const DEFAULT_MOBILE: MobileMethod = "bkash"

function amountOf(text: string): number | null {
  return text.trim() ? parseTaka(text) : 0
}

/** পেমেন্ট পাতার ঘরগুলো থেকে ক্যাশ/মোবাইলের পরিমাণ (পয়সা) বের করে; ভুল লেখা হলে ok=false */
export function resolveEntry(input: EntryInput): EntryResult {
  const { mode, method, amount, cashInput, mobileInput, splitMethod, total } = input

  if (mode === "single") {
    const value = amount === null ? total : amountOf(amount)
    if (value == null) return { ok: false }
    if (method === "cash") return { ok: true, cash: value, mobile: 0, mobileMethod: DEFAULT_MOBILE }
    return { ok: true, cash: 0, mobile: value, mobileMethod: method }
  }

  const mobile = amountOf(mobileInput)
  if (mobile == null) return { ok: false }
  const cash = cashInput === null ? Math.max(0, total - mobile) : amountOf(cashInput)
  if (cash == null) return { ok: false }
  return { ok: true, cash, mobile, mobileMethod: splitMethod }
}

const ROUND_STEPS_TAKA = [50, 100, 500, 1000] as const
const MAX_QUICK = 3

/** ক্যাশে সাধারণত যে নোটে দেওয়া হয়: মোটের ওপরের গোল অঙ্ক (পয়সায়), সর্বোচ্চ ৩টি, ছোট থেকে বড় */
export function quickCashAmounts(total: number): number[] {
  if (total <= 0) return []
  const out: number[] = []
  for (const step of ROUND_STEPS_TAKA) {
    const unit = step * 100
    const rounded = Math.ceil(total / unit) * unit
    if (rounded > total && !out.includes(rounded)) out.push(rounded)
  }
  return out.slice(0, MAX_QUICK)
}
