import { tr } from "../i18n"
import { localDateIso } from "../domain/dates"
import { DomainError } from "../domain/errors"
import { normalizeBdPhone } from "../format/phone"
import { newId } from "./db"
import type { Dealer, DealerEntry, Db } from "./types"

export const DEALER_NAME_MAX = 60
export const DEALER_NOTE_MAX = 120
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function activeDealers(db: Db): Dealer[] {
  return (db.dealers ?? []).filter((d) => !d.deleted)
}

export function findDealer(db: Db, id: string): Dealer | undefined {
  return activeDealers(db).find((d) => d.id === id)
}

export function addDealer(db: Db, input: { name: string; phone: string }, now: Date): { db: Db; dealer: Dealer } {
  const name = input.name.trim().slice(0, DEALER_NAME_MAX)
  if (!name) throw new DomainError("name_required", tr("ডিলারের নাম দিন"))
  if (activeDealers(db).some((d) => d.name.toLowerCase() === name.toLowerCase())) throw new DomainError("duplicate_dealer", tr("এই নামে ডিলার আগে থেকেই আছে"))
  const phone = input.phone.trim() ? normalizeBdPhone(input.phone) : ""
  if (phone === null) throw new DomainError("invalid_phone", tr("মোবাইল নম্বর সঠিক নয়"))
  const dealer: Dealer = { id: newId(), name, phone, createdAt: now.toISOString() }
  return { db: { ...db, dealers: [...(db.dealers ?? []), dealer] }, dealer }
}

export function updateDealer(db: Db, id: string, input: { name: string; phone: string }): Db {
  if (!findDealer(db, id)) throw new DomainError("dealer_not_found", tr("ডিলার পাওয়া যায়নি"))
  const name = input.name.trim().slice(0, DEALER_NAME_MAX)
  if (!name) throw new DomainError("name_required", tr("ডিলারের নাম দিন"))
  if (activeDealers(db).some((d) => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) throw new DomainError("duplicate_dealer", tr("এই নামে ডিলার আগে থেকেই আছে"))
  const phone = input.phone.trim() ? normalizeBdPhone(input.phone) : ""
  if (phone === null) throw new DomainError("invalid_phone", tr("মোবাইল নম্বর সঠিক নয়"))
  return { ...db, dealers: (db.dealers ?? []).map((d) => (d.id === id ? { ...d, name, phone } : d)) }
}

/** পাওনা বাকি থাকলে ডিলার মোছা যায় না, নইলে হিসাব হারিয়ে যেত */
export function removeDealer(db: Db, id: string): Db {
  if (!findDealer(db, id)) throw new DomainError("dealer_not_found", tr("ডিলার পাওয়া যায়নি"))
  if (dealerBalance(db, id) !== 0) throw new DomainError("dealer_has_balance", tr("হিসাব মেটার আগে ডিলার মোছা যায় না"))
  return { ...db, dealers: (db.dealers ?? []).map((d) => (d.id === id ? { ...d, deleted: true } : d)) }
}

interface EntryInput {
  kind: DealerEntry["kind"]
  amount: number
  date: string
  dueDate?: string
  note: string
}

function validateEntry(input: EntryInput, now: Date): void {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DomainError("amount_required", tr("টাকার পরিমাণ দিন"))
  if (!ISO_DATE.test(input.date) || Number.isNaN(Date.parse(input.date))) throw new DomainError("invalid_date", tr("তারিখ সঠিক নয়"))
  if (input.date > localDateIso(now)) throw new DomainError("future_date", tr("ভবিষ্যতের তারিখ দেওয়া যায় না"))
  if (input.dueDate) {
    if (input.kind !== "purchase") throw new DomainError("invalid_due", tr("শুধু মাল নেওয়ায় শোধের তারিখ দেওয়া যায়"))
    if (!ISO_DATE.test(input.dueDate) || Number.isNaN(Date.parse(input.dueDate))) throw new DomainError("invalid_date", tr("তারিখ সঠিক নয়"))
    if (input.dueDate < input.date) throw new DomainError("due_before_date", tr("শোধের তারিখ মাল নেওয়ার আগে হতে পারে না"))
  }
}

function build(input: EntryInput): Pick<DealerEntry, "kind" | "amount" | "date" | "note"> & { dueDate?: string } {
  const base = { kind: input.kind, amount: input.amount, date: input.date, note: input.note.trim().slice(0, DEALER_NOTE_MAX) }
  return input.kind === "purchase" && input.dueDate ? { ...base, dueDate: input.dueDate } : base
}

export function addDealerEntry(db: Db, dealerId: string, input: EntryInput, by: string, now: Date): Db {
  if (!findDealer(db, dealerId)) throw new DomainError("dealer_not_found", tr("ডিলার পাওয়া যায়নি"))
  validateEntry(input, now)
  const entry: DealerEntry = { id: newId(), dealerId, ...build(input), at: now.toISOString(), by }
  return { ...db, dealerEntries: [...(db.dealerEntries ?? []), entry] }
}

export function updateDealerEntry(db: Db, id: string, input: EntryInput, now: Date): Db {
  const list = db.dealerEntries ?? []
  const old = list.find((x) => x.id === id && !x.deleted)
  if (!old) throw new DomainError("entry_not_found", tr("লেনদেন পাওয়া যায়নি"))
  validateEntry(input, now)
  const { dueDate: _drop, ...rest } = old
  return { ...db, dealerEntries: list.map((x) => (x.id === id ? { ...rest, ...build(input) } : x)) }
}

export function removeDealerEntry(db: Db, id: string): Db {
  const list = db.dealerEntries ?? []
  if (!list.some((x) => x.id === id && !x.deleted)) throw new DomainError("entry_not_found", tr("লেনদেন পাওয়া যায়নি"))
  return { ...db, dealerEntries: list.map((x) => (x.id === id ? { ...x, deleted: true } : x)) }
}

/** ডিলারের সক্রিয় লেনদেন, পুরনো আগে (তারিখ, তারপর এন্ট্রির সময়) */
export function dealerEntries(db: Db, dealerId: string): DealerEntry[] {
  return (db.dealerEntries ?? [])
    .filter((x) => x.dealerId === dealerId && !x.deleted)
    .sort((a, b) => (a.date === b.date ? (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) : a.date < b.date ? -1 : 1))
}

/** ধনাত্মক = ডিলারকে দিতে হবে, ঋণাত্মক = অগ্রিম দেওয়া আছে */
export function dealerBalance(db: Db, dealerId: string): number {
  return dealerEntries(db, dealerId).reduce((s, x) => s + (x.kind === "purchase" ? x.amount : -x.amount), 0)
}

export interface DealerStatus {
  balance: number
  /** এখনো শোধ হয়নি এমন মাল-নেওয়ার সবচেয়ে আগের শোধের তারিখ; নেই হলে null */
  nextDue: string | null
  overdue: boolean
}

/** টাকা দেওয়াকে সবচেয়ে পুরনো মাল-নেওয়ার বিপরীতে ধরা হয় (FIFO), বাকিগুলোর শোধের তারিখ দেখে মেয়াদ পেরোনো ঠিক হয় */
export function dealerStatus(db: Db, dealerId: string, today: string): DealerStatus {
  const entries = dealerEntries(db, dealerId)
  let paid = entries.filter((x) => x.kind === "payment").reduce((s, x) => s + x.amount, 0)
  let nextDue: string | null = null
  let balance = 0
  for (const x of entries) balance += x.kind === "purchase" ? x.amount : -x.amount
  for (const x of entries) {
    if (x.kind !== "purchase") continue
    const settled = Math.min(paid, x.amount)
    paid -= settled
    if (x.amount - settled > 0 && x.dueDate && (nextDue === null || x.dueDate < nextDue)) nextDue = x.dueDate
  }
  return { balance, nextDue, overdue: balance > 0 && nextDue !== null && nextDue < today }
}

export interface DealerRow extends DealerStatus {
  dealer: Dealer
}

/** পাওনা বেশি আগে; মেয়াদ-পেরোনো সবার ওপরে */
export function dealerRows(db: Db, today: string): DealerRow[] {
  return activeDealers(db)
    .map((dealer) => ({ dealer, ...dealerStatus(db, dealer.id, today) }))
    .sort((a, b) => (a.overdue !== b.overdue ? (a.overdue ? -1 : 1) : b.balance - a.balance || a.dealer.name.localeCompare(b.dealer.name)))
}

export interface PayableSummary {
  total: number
  count: number
  overdueCount: number
  overdueTotal: number
}

/** মোট কত ডিলারকে কত টাকা দিতে হবে (অগ্রিম ধরা হয় না) */
export function payableSummary(rows: readonly DealerRow[]): PayableSummary {
  const owing = rows.filter((r) => r.balance > 0)
  const overdue = owing.filter((r) => r.overdue)
  return {
    total: owing.reduce((s, r) => s + r.balance, 0),
    count: owing.length,
    overdueCount: overdue.length,
    overdueTotal: overdue.reduce((s, r) => s + r.balance, 0),
  }
}

/** লেনদেনের পর চলতি পাওনা, পুরনো থেকে নতুন ক্রমে */
export function runningBalances(entries: readonly DealerEntry[]): Map<string, number> {
  const out = new Map<string, number>()
  let bal = 0
  for (const x of entries) {
    bal += x.kind === "purchase" ? x.amount : -x.amount
    out.set(x.id, bal)
  }
  return out
}
