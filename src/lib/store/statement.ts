import { formatBillNo } from "../domain/bill"
import { formatTaka } from "../domain/money"
import { formatDateTimeBn } from "../format/datetime"
import type { LedgerEntry } from "./types"

/** খাতার এক সারির নাম (পর্দা ও ছবি দুই জায়গায় একই) */
export function ledgerTitle(e: LedgerEntry): string {
  const bill = e.saleNo != null ? formatBillNo({ no: e.saleNo, prefix: e.salePrefix }) : ""
  if (e.kind === "payment") return "জমা"
  if (e.kind === "opening") return "আগের বাকি"
  return e.kind === "void" ? `বিল #${bill} বাতিল` : `বিল #${bill}`
}

export interface StatementRow {
  title: string
  when: string
  /** চিহ্নসহ অঙ্ক: বাকি বাড়লে +, কমলে − */
  amountText: string
  reduces: boolean
  /** এই লেনদেনের পরের বাকি (পয়সায়) */
  balance: number
}

export interface Statement {
  rows: StatementRow[]
  balance: number
  /** সীমার কারণে বাদ পড়া পুরনো লেনদেনের সংখ্যা */
  skipped: number
}

export const STATEMENT_MAX_ROWS = 40

/** একজন কাস্টমারের খাতা পুরনো থেকে নতুন ক্রমে, প্রতি সারিতে চলতি বাকিসহ; শুধু শেষ STATEMENT_MAX_ROWS টি দেখায় */
export function buildStatement(ledger: readonly LedgerEntry[], customerId: string): Statement {
  const mine = ledger.filter((e) => e.customerId === customerId).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  let run = 0
  const all: StatementRow[] = mine.map((e) => {
    const reduces = e.kind === "payment" || e.kind === "void"
    run += reduces ? -e.amount : e.amount
    return { title: ledgerTitle(e), when: formatDateTimeBn(e.at), amountText: `${reduces ? "−" : "+"}${formatTaka(e.amount)}`, reduces, balance: run }
  })
  const skipped = Math.max(0, all.length - STATEMENT_MAX_ROWS)
  return { rows: all.slice(skipped), balance: run, skipped }
}
