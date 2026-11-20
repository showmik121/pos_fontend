import { formatBillNo } from "../domain/bill"
import type { PaymentMethod } from "../domain/cart"
import { customerBalance, totalStock } from "./selectors"
import type { Db } from "./types"

/** Excel-এ বাংলা ঠিকভাবে খুলতে ফাইলের শুরুতে BOM লাগে */
const BOM = "﻿"

const METHOD_BN: Record<PaymentMethod, string> = { cash: "ক্যাশ", bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট" }
const LEDGER_BN = { sale: "বাকিতে বিক্রি", opening: "আগের বাকি", payment: "বাকি আদায়", void: "বিল বাতিল (বাকি ফেরত)" } as const

function cell(v: string | number): string {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
}

/** পয়সা → টাকা (Excel-এ সংখ্যা হিসেবে যোগ করা যায়: ১২৫০, ৯৯.৫) */
export function takaCell(poisha: number): number {
  return Math.round(poisha) / 100
}

/** স্থানীয় সময়ে Excel-এর চেনা আকারে: "2026-11-20 08:50" */
export function dateCell(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** পণ্য ও স্টক: প্রতি পণ্যে এখন কত পিস, কেনা/বিক্রির দাম */
export function stockReportCsv(db: Db): string {
  const rows = db.products.map((p) => [p.name, p.category, totalStock(db, p.id), p.minStock, takaCell(p.costPoisha), takaCell(p.pricePoisha)])
  return toCsv(["পণ্য", "ধরন", "স্টক (পিস)", "সর্বনিম্ন স্টক", "কেনা দাম (টাকা)", "বিক্রির দাম (টাকা)"], rows)
}

/** বিক্রির তালিকা: প্রতি বিলে একটি সারি (বাতিল বিলও থাকে, অবস্থা কলামে লেখা) */
export function salesReportCsv(db: Db): string {
  const rows = [...db.sales]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((s) => [
      formatBillNo(s),
      dateCell(s.at),
      s.customerName ?? "",
      s.lines.map((l) => `${l.name} × ${l.qty}`).join("; "),
      takaCell(s.total),
      s.payments.map((p) => `${METHOD_BN[p.method]} ${takaCell(p.amount)}`).join("; "),
      takaCell(s.due),
      s.cashier,
      s.voided ? "বাতিল" : "ঠিক আছে",
    ])
  return toCsv(["বিল নম্বর", "তারিখ", "কাস্টমার", "পণ্য", "মোট (টাকা)", "পেমেন্ট", "বাকি (টাকা)", "বিক্রেতা", "অবস্থা"], rows)
}

/** বাকির খাতা: কাস্টমার-ভিত্তিক সারাংশ, তারপর প্রতিটি লেনদেন */
export function duesReportCsv(db: Db): string {
  const name = new Map(db.customers.map((c) => [c.id, c.name]))
  const rows = [...db.ledger]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => [
      dateCell(e.at),
      name.get(e.customerId) ?? "",
      LEDGER_BN[e.kind],
      e.saleNo ? formatBillNo({ no: e.saleNo, prefix: e.salePrefix }) : "",
      takaCell(e.kind === "payment" || e.kind === "void" ? -e.amount : e.amount),
      takaCell(customerBalance(db, e.customerId)),
    ])
  return toCsv(["তারিখ", "কাস্টমার", "ধরন", "বিল নম্বর", "বাকি বাড়ল/কমল (টাকা)", "এখন মোট বাকি (টাকা)"], rows)
}

/** খরচের খাতা: প্রতিটি খরচ, তারিখ ও ক্যাটেগরি সহ (মোছা খরচ বাদ) */
export function expensesReportCsv(db: Db): string {
  const cats = new Map((db.expenseCategories ?? []).map((c) => [c.id, c.name]))
  const rows = (db.expenses ?? [])
    .filter((x) => !x.deleted)
    .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
    .map((x) => [x.date, cats.get(x.categoryId) ?? "অন্যান্য", takaCell(x.amount), x.note, x.by])
  return toCsv(["তারিখ", "ক্যাটেগরি", "খরচ (টাকা)", "নোট", "লিখেছেন"], rows)
}

export function reportFileName(kind: "stock" | "sales" | "dues" | "expenses", now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  const day = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  return { stock: `stock-hisab-${day}.csv`, sales: `bikri-hisab-${day}.csv`, dues: `baki-khata-${day}.csv`, expenses: `khoroch-${day}.csv` }[kind]
}
