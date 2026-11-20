import { tr } from "../i18n"
import { localDateIso } from "../domain/dates"
import { DomainError } from "../domain/errors"
import { newId } from "./db"
import type { Db, Expense, ExpenseCategory } from "./types"

export const EXPENSE_NOTE_MAX = 120
export const CATEGORY_NAME_MAX = 40
export const CATEGORY_ICONS = ["💵", "🏪", "💡", "🧾", "👥", "🚚", "📱", "🔧", "🍵", "🧹", "📦", "💧"] as const

/** সব দোকানে একই id, তাই দুই ফোনে ডিফল্ট বসলেও দ্বিগুণ হয় না */
const DEFAULTS: { id: string; name: string; icon: string }[] = [
  { id: "default:salary", name: "বেতন", icon: "💵" },
  { id: "default:rent", name: "দোকান ভাড়া", icon: "🏪" },
  { id: "default:electricity", name: "বিদ্যুৎ বিল", icon: "💡" },
  { id: "default:daily", name: "দৈনিক খরচ", icon: "🧾" },
  { id: "default:employee", name: "কর্মচারীর খরচ", icon: "👥" },
]

/** ক্যাটেগরি তালিকা এখনো নেই (undefined) হলে ডিফল্টগুলো বসায়; থাকলে একই Db ফেরায় */
export function ensureDefaultCategories(db: Db, now: Date): Db {
  if (db.expenseCategories !== undefined) return db
  const at = now.toISOString()
  return { ...db, expenseCategories: DEFAULTS.map((d) => ({ ...d, createdAt: at })) }
}

export function activeCategories(db: Db): ExpenseCategory[] {
  return (db.expenseCategories ?? []).filter((c) => !c.deleted)
}

export function addExpenseCategory(db: Db, input: { name: string; icon: string }, now: Date): { db: Db; category: ExpenseCategory } {
  const name = input.name.trim().slice(0, CATEGORY_NAME_MAX)
  if (!name) throw new DomainError("name_required", tr("ক্যাটেগরির নাম দিন"))
  if (activeCategories(db).some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new DomainError("duplicate_category", tr("এই নামে ক্যাটেগরি আগে থেকেই আছে"))
  const category: ExpenseCategory = { id: newId(), name, icon: input.icon || "🧾", createdAt: now.toISOString() }
  return { db: { ...db, expenseCategories: [...(db.expenseCategories ?? []), category] }, category }
}

export function removeExpenseCategory(db: Db, id: string): Db {
  const list = db.expenseCategories ?? []
  if (!list.some((c) => c.id === id)) throw new DomainError("category_not_found", tr("ক্যাটেগরি পাওয়া যায়নি"))
  return { ...db, expenseCategories: list.map((c) => (c.id === id ? { ...c, deleted: true } : c)) }
}

interface ExpenseInput {
  categoryId: string
  amount: number
  note: string
  date: string
}

function validate(db: Db, input: ExpenseInput, now: Date): void {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DomainError("amount_required", tr("খরচের পরিমাণ দিন"))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) throw new DomainError("invalid_date", tr("তারিখ সঠিক নয়"))
  if (input.date > localDateIso(now)) throw new DomainError("future_date", tr("ভবিষ্যতের তারিখ দেওয়া যায় না"))
  if (!activeCategories(db).some((c) => c.id === input.categoryId)) throw new DomainError("category_not_found", tr("ক্যাটেগরি বাছুন"))
}

export function addExpense(db: Db, input: ExpenseInput, by: string, now: Date): Db {
  validate(db, input, now)
  const expense: Expense = { id: newId(), categoryId: input.categoryId, amount: input.amount, note: input.note.trim().slice(0, EXPENSE_NOTE_MAX), date: input.date, at: now.toISOString(), by }
  return { ...db, expenses: [...(db.expenses ?? []), expense] }
}

export function updateExpense(db: Db, id: string, input: ExpenseInput, now: Date): Db {
  const list = db.expenses ?? []
  if (!list.some((x) => x.id === id && !x.deleted)) throw new DomainError("expense_not_found", tr("খরচ পাওয়া যায়নি"))
  validate(db, input, now)
  return { ...db, expenses: list.map((x) => (x.id === id ? { ...x, categoryId: input.categoryId, amount: input.amount, note: input.note.trim().slice(0, EXPENSE_NOTE_MAX), date: input.date } : x)) }
}

export function removeExpense(db: Db, id: string): Db {
  const list = db.expenses ?? []
  if (!list.some((x) => x.id === id)) throw new DomainError("expense_not_found", tr("খরচ পাওয়া যায়নি"))
  return { ...db, expenses: list.map((x) => (x.id === id ? { ...x, deleted: true } : x)) }
}

/** from..to (দুটোই অন্তর্ভুক্ত) তারিখের খরচ, নতুন আগে */
export function expensesBetween(db: Db, from: string, to: string): Expense[] {
  return (db.expenses ?? [])
    .filter((x) => !x.deleted && x.date >= from && x.date <= to)
    .sort((a, b) => (a.date === b.date ? (a.at < b.at ? 1 : -1) : a.date < b.date ? 1 : -1))
}

export function expenseTotal(db: Db, from: string, to: string): number {
  return expensesBetween(db, from, to).reduce((s, x) => s + x.amount, 0)
}

export interface CategoryTotal {
  categoryId: string
  name: string
  icon: string
  total: number
}

/** ক্যাটেগরি-ভিত্তিক মোট (বেশি আগে); মোছা ক্যাটেগরির খরচও নামসহ আসে */
export function categoryTotals(db: Db, from: string, to: string): CategoryTotal[] {
  const names = new Map((db.expenseCategories ?? []).map((c) => [c.id, c]))
  const sums = new Map<string, number>()
  for (const x of expensesBetween(db, from, to)) sums.set(x.categoryId, (sums.get(x.categoryId) ?? 0) + x.amount)
  return [...sums.entries()]
    .map(([categoryId, total]) => ({ categoryId, name: names.get(categoryId)?.name ?? "অন্যান্য", icon: names.get(categoryId)?.icon ?? "🧾", total }))
    .sort((a, b) => b.total - a.total)
}

/** তারিখের মাসের প্রথম ও শেষ দিন: ["2026-11-01","2026-11-30"] */
export function monthRange(date: string): [string, string] {
  const [y, m] = date.split("-").map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const p = (n: number) => String(n).padStart(2, "0")
  return [`${y}-${p(m)}-01`, `${y}-${p(m)}-${p(last)}`]
}
