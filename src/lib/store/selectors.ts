import { addDays, localDateIso } from "../domain/dates"
import { classifyExpiry, daysUntil } from "../domain/expiry"
import { sellableBatches } from "../domain/fifo"
import type { Batch, Customer, Db, Product, Sale } from "./types"

export function findProduct(db: Db, id: string): Product | undefined {
  return db.products.find((p) => p.id === id)
}

export function findByBarcode(db: Db, code: string): { product: Product; packSize: number } | undefined {
  const c = code.trim()
  if (!c) return undefined
  for (const product of db.products) {
    const hit = product.barcodes.find((b) => b.code === c)
    if (hit) return { product, packSize: hit.packSize }
  }
  return undefined
}

export function batchesOf(db: Db, productId: string): Batch[] {
  return db.batches.filter((b) => b.productId === productId)
}

/** মোট স্টক (মেয়াদোত্তীর্ণ সহ) */
export function totalStock(db: Db, productId: string): number {
  return batchesOf(db, productId).reduce((s, b) => s + b.qtyRemaining, 0)
}

/** বিক্রি করা যায় এমন স্টক */
export function sellableStock(db: Db, productId: string, today: string): number {
  return sellableBatches(batchesOf(db, productId), today).reduce((s, b) => s + b.qtyRemaining, 0)
}

export function expiredStock(db: Db, productId: string, today: string): Batch[] {
  return batchesOf(db, productId).filter((b) => b.qtyRemaining > 0 && classifyExpiry(b.expiryDate, today) === "expired")
}

/** সবচেয়ে কাছের মেয়াদ (মেয়াদোত্তীর্ণ ছাড়া) কত দিনে */
export function nearestExpiryDays(db: Db, productId: string, today: string): number | null {
  const first = sellableBatches(batchesOf(db, productId), today).find((b) => b.expiryDate)
  return first?.expiryDate ? daysUntil(first.expiryDate, today) : null
}

export function isLowStock(db: Db, p: Product, today: string): boolean {
  return sellableStock(db, p.id, today) < p.minStock
}

export function lowStockProducts(db: Db, today: string): Product[] {
  return db.products.filter((p) => isLowStock(db, p, today))
}

export interface ExpiryRow {
  batch: Batch
  product: Product
  days: number
}

export interface ExpiryBuckets {
  expired: ExpiryRow[]
  within30: ExpiryRow[]
  within60: ExpiryRow[]
  within90: ExpiryRow[]
}

export function expiryBuckets(db: Db, today: string): ExpiryBuckets {
  const out: ExpiryBuckets = { expired: [], within30: [], within60: [], within90: [] }
  for (const batch of db.batches) {
    if (batch.qtyRemaining <= 0 || !batch.expiryDate) continue
    const product = findProduct(db, batch.productId)
    if (!product) continue
    const days = daysUntil(batch.expiryDate, today)
    const row = { batch, product, days }
    if (days <= 0) out.expired.push(row)
    else if (days <= 30) out.within30.push(row)
    else if (days <= 60) out.within60.push(row)
    else if (days <= 90) out.within90.push(row)
  }
  const byDays = (a: ExpiryRow, b: ExpiryRow) => a.days - b.days
  for (const list of Object.values(out)) list.sort(byDays)
  return out
}

/** ৩০ দিনের মধ্যে মেয়াদ শেষ হবে এমন ব্যাচের সংখ্যা */
export function expiringSoonCount(db: Db, today: string): number {
  return expiryBuckets(db, today).within30.length
}

export function customerBalance(db: Db, customerId: string): number {
  let sum = 0
  for (const e of db.ledger) {
    if (e.customerId !== customerId) continue
    sum += e.kind === "payment" || e.kind === "void" ? -e.amount : e.amount
  }
  return sum
}

export interface DueRow {
  customer: Customer
  balance: number
  lastAt: string
}

export function dueRows(db: Db): DueRow[] {
  const rows: DueRow[] = []
  for (const customer of db.customers) {
    const balance = customerBalance(db, customer.id)
    if (balance <= 0) continue
    const last = db.ledger.filter((e) => e.customerId === customer.id).reduce((m, e) => (e.at > m ? e.at : m), customer.createdAt)
    rows.push({ customer, balance, lastAt: last })
  }
  return rows
}

export function totalDue(db: Db): number {
  return dueRows(db).reduce((s, r) => s + r.balance, 0)
}

export function saleDate(sale: Sale): string {
  return localDateIso(new Date(sale.at))
}

export function salesOn(db: Db, date: string): Sale[] {
  return db.sales.filter((s) => !s.voided && saleDate(s) === date)
}

export interface DaySummary {
  bills: number
  total: number
  profit: number
  cash: number
  mobile: number
  due: number
}

export function daySummary(db: Db, date: string): DaySummary {
  const out: DaySummary = { bills: 0, total: 0, profit: 0, cash: 0, mobile: 0, due: 0 }
  for (const s of salesOn(db, date)) {
    out.bills += 1
    out.total += s.total
    out.due += s.due
    let cost = 0
    for (const l of s.lines) for (const a of l.allocations) cost += a.costPoisha * a.qty
    out.profit += s.total - cost
    for (const p of s.payments) {
      if (p.method === "cash") out.cash += p.amount
      else out.mobile += p.amount
    }
    out.cash -= s.change
  }
  return out
}

export interface TopRow {
  productId: string
  name: string
  qty: number
  revenue: number
}

/** from..to (দুটোই অন্তর্ভুক্ত) সময়ে সবচেয়ে বেশি বিক্রি হওয়া পণ্য, পরিমাণ অনুযায়ী */
export function topProducts(db: Db, from: string, to: string, limit = 10): TopRow[] {
  const map = new Map<string, TopRow>()
  for (const s of db.sales) {
    if (s.voided) continue
    const d = saleDate(s)
    if (d < from || d > to) continue
    for (const l of s.lines) {
      const prev = map.get(l.productId) ?? { productId: l.productId, name: l.name, qty: 0, revenue: 0 }
      map.set(l.productId, { ...prev, qty: prev.qty + l.qty, revenue: prev.revenue + (l.unitPrice * l.qty - l.discount) })
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, limit)
}

export function rangeStart(today: string, days: number): string {
  return addDays(today, -(days - 1))
}
