import type { Batch, Db, LedgerEntry, Sale } from "../store/types"
import { batchRemovedEvent, customerEvent, dueEvent, expenseCategoryEvent, expenseEvent, noteEvent, productEvent, saleEvent, settingsEvent, stockInEvent, voidEvent, type SyncEvent } from "./events"
import { withClock } from "./replay"

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
const sumAlloc = (sales: readonly Sale[], batchId: string) =>
  sales.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.allocations.filter((a) => a.batchId === batchId).reduce((x, a) => x + a.qty, 0), 0), 0)
const ledgerOf = (db: Db, sale: Sale, kind: LedgerEntry["kind"], known: ReadonlySet<string>) =>
  db.ledger.find((l) => l.kind === kind && !known.has(l.id) && l.saleNo === sale.no && l.salePrefix === sale.prefix && l.customerId === sale.customerId) ?? null

/**
 * স্থানীয় বদল (before → after) থেকে সিংক ইভেন্ট বের করে। UI-র প্রতিটি অ্যাকশনে হাত না দিয়ে একটি জায়গাতেই ধরা যায়।
 * ফেরত db-তে ঘড়ি/`rcpt`/বাতিলের খাতার id বসানো থাকে, যাতে সার্ভার থেকে নিজের ইভেন্ট ফিরে এলে দ্বিতীয়বার না ধরে।
 */
export function eventsFromChange(before: Db, after: Db, newId: () => string, now: Date): { events: SyncEvent[]; db: Db } {
  const events: SyncEvent[] = []
  let db = after
  const at = now.toISOString()
  const clock = (key: string, e: SyncEvent) => {
    db = withClock(db, key, e)
    events.push(e)
  }

  if (after.products !== before.products)
    for (const p of after.products) {
      const prev = before.products.find((x) => x.id === p.id)
      if (!prev || !same(prev, p)) clock(`product:${p.id}`, productEvent(newId(), p, at))
    }
  if (after.customers !== before.customers)
    for (const c of after.customers) {
      const prev = before.customers.find((x) => x.id === c.id)
      if (!prev || !same(prev, c)) clock(`customer:${c.id}`, customerEvent(newId(), c, at))
    }
  if (after.notes !== before.notes)
    for (const n of after.notes ?? []) {
      const prev = (before.notes ?? []).find((x) => x.id === n.id)
      if (!prev || !same(prev, n)) clock(`note:${n.id}`, noteEvent(newId(), n, at))
    }
  if (after.expenseCategories !== before.expenseCategories)
    for (const c of after.expenseCategories ?? []) {
      const prev = (before.expenseCategories ?? []).find((x) => x.id === c.id)
      if (!prev || !same(prev, c)) clock(`expcat:${c.id}`, expenseCategoryEvent(newId(), c, at))
    }
  if (after.expenses !== before.expenses)
    for (const x of after.expenses ?? []) {
      const prev = (before.expenses ?? []).find((y) => y.id === x.id)
      if (!prev || !same(prev, x)) clock(`exp:${x.id}`, expenseEvent(newId(), x, at))
    }
  if (!same(before.settings, after.settings)) clock("settings", settingsEvent(newId(), after.settings, at))

  const knownLedger = new Set(before.ledger.map((l) => l.id))
  const beforeSales = new Map(before.sales.map((s) => [s.id, s]))
  const newSales = after.sales.filter((s) => !beforeSales.has(s.id))
  const newlyVoided = after.sales.filter((s) => s.voided && !beforeSales.get(s.id)?.voided)
  const handledLedger = new Set<string>()

  for (const s of newSales) {
    const lg = ledgerOf(after, s, "sale", knownLedger)
    if (lg) handledLedger.add(lg.id)
    const { voided: _v, ...open } = s
    events.push(saleEvent(newId(), open as Sale, lg, s.at))
  }
  const fixedIds = new Map<string, string>()
  for (const s of newlyVoided) {
    const lg = ledgerOf(after, s, "void", knownLedger)
    if (lg) {
      handledLedger.add(lg.id)
      fixedIds.set(lg.id, `void:${s.id}`)
    }
    events.push(voidEvent(newId(), s.id, s.voided!, lg))
  }
  if (fixedIds.size) db = { ...db, ledger: db.ledger.map((l) => (fixedIds.has(l.id) ? { ...l, id: fixedIds.get(l.id)! } : l)) }
  for (const l of after.ledger)
    if (!knownLedger.has(l.id) && !handledLedger.has(l.id) && (l.kind === "payment" || l.kind === "opening")) events.push(dueEvent(newId(), l, l.at))

  const knownRemoved = new Set((before.removedBatches ?? []).map((r) => r.id))
  for (const r of after.removedBatches ?? []) if (!knownRemoved.has(r.id)) events.push(batchRemovedEvent(newId(), r))

  // স্টক-জমা = ব্যাচের পরিমাণ বাড়া থেকে বিক্রি/বাতিলে বদল বাদ দিয়ে যা থাকে
  const prevBatch = new Map(before.batches.map((b) => [b.id, b]))
  const stocked = new Map<string, string>()
  for (const b of after.batches) {
    const prev = prevBatch.get(b.id)
    if (prev === b) continue
    const delta = b.qtyRemaining - (prev?.qtyRemaining ?? 0)
    const residual = delta + sumAlloc(newSales, b.id) - sumAlloc(newlyVoided, b.id)
    if (residual > 0) {
      const id = newId()
      stocked.set(b.id, id)
      events.push(stockInEvent(id, b, residual, at))
    }
  }
  if (stocked.size)
    db = { ...db, batches: db.batches.map((b): Batch => (stocked.has(b.id) ? { ...b, rcpt: [...(b.rcpt ?? []), stocked.get(b.id)!] } : b)) }
  return { events, db }
}
