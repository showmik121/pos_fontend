import type { Batch, Customer, Db, LedgerEntry, Note, Product, RemovedBatch, Sale } from "../store/types"
import { EVENT_KINDS, type SyncEvent } from "./events"

/** সার্ভারের সীমার সাথে মেলে */
const KIND_RE = /^[a-z][a-z0-9_]{1,39}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_PAYLOAD_BYTES = 40000

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)

/** ইভেন্ট চুক্তি মানলে একই অবজেক্ট, নইলে null (সার্ভার থেকে আসা বা সার্ভারে যাওয়া ইভেন্ট যাচাইয়ে) */
export function validateEvent(x: unknown): SyncEvent | null {
  if (!isObj(x)) return null
  const { id, kind, at, payload } = x
  if (typeof id !== "string" || !UUID_RE.test(id)) return null
  if (typeof kind !== "string" || !KIND_RE.test(kind)) return null
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null
  if (!isObj(payload)) return null
  if (new TextEncoder().encode(JSON.stringify(payload)).length >= MAX_PAYLOAD_BYTES) return null
  return { id, kind, at, payload }
}

export interface ReplayResult {
  db: Db
  /** নির্ভর করা তথ্য (বিল/ব্যাচ) এখনো আসেনি; পরে আবার দিতে হবে */
  deferred: SyncEvent[]
  /** অচেনা ধরন বা নষ্ট পেলোড; বাদ */
  ignored: SyncEvent[]
}

type Outcome = { db: Db } | "defer" | "ignore"

export const stamp = (e: SyncEvent) => `${e.at}|${e.id}`
const compareEvents = (a: SyncEvent, b: SyncEvent) => (stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0)

/** শেষ-বদল-জেতে: ঘড়ির চেয়ে নতুন হলে true */
function isNewer(db: Db, key: string, e: SyncEvent): boolean {
  const cur = db.sync?.clocks[key]
  return cur === undefined || stamp(e) > cur
}

export function withClock(db: Db, key: string, e: SyncEvent): Db {
  return { ...db, sync: { clocks: { ...(db.sync?.clocks ?? {}), [key]: stamp(e) } } }
}

const upsertById = <T extends { id: string }>(list: readonly T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

function removedIds(db: Db): Set<string> {
  return new Set((db.removedBatches ?? []).flatMap((r) => (r.batchId ? [r.batchId] : [])))
}

function applyProduct(db: Db, e: SyncEvent): Outcome {
  const product = e.payload.product as Product | undefined
  if (!isObj(product) || typeof product.id !== "string") return "ignore"
  const key = `product:${product.id}`
  if (!isNewer(db, key, e)) return { db }
  return { db: withClock({ ...db, products: upsertById(db.products, product) }, key, e) }
}

function applyCustomer(db: Db, e: SyncEvent): Outcome {
  const customer = e.payload.customer as Customer | undefined
  if (!isObj(customer) || typeof customer.id !== "string") return "ignore"
  const key = `customer:${customer.id}`
  if (!isNewer(db, key, e)) return { db }
  return { db: withClock({ ...db, customers: upsertById(db.customers, customer) }, key, e) }
}

function applyNote(db: Db, e: SyncEvent): Outcome {
  const note = e.payload.note as Note | undefined
  if (!isObj(note) || typeof note.id !== "string" || typeof note.text !== "string") return "ignore"
  const key = `note:${note.id}`
  if (!isNewer(db, key, e)) return { db }
  return { db: withClock({ ...db, notes: upsertById(db.notes ?? [], note) }, key, e) }
}

function applySettings(db: Db, e: SyncEvent): Outcome {
  const settings = e.payload.settings as Db["settings"] | undefined
  if (!isObj(settings)) return "ignore"
  if (!isNewer(db, "settings", e)) return { db }
  return { db: withClock({ ...db, settings }, "settings", e) }
}

function applyStockIn(db: Db, e: SyncEvent): Outcome {
  const p = e.payload
  const { batchId, productId, batchNo, expiryDate, qty, costPoisha, receivedAt } = p
  if (typeof batchId !== "string" || typeof productId !== "string" || typeof batchNo !== "string") return "ignore"
  if (typeof qty !== "number" || typeof costPoisha !== "number" || typeof receivedAt !== "string") return "ignore"
  if (removedIds(db).has(batchId)) return { db }
  const existing = db.batches.find((b) => b.id === batchId)
  const key = `batch:${batchId}`
  if (!existing) {
    const batch: Batch = {
      id: batchId,
      productId,
      batchNo,
      expiryDate: typeof expiryDate === "string" ? expiryDate : null,
      qtyRemaining: qty,
      costPoisha,
      receivedAt,
      rcpt: [e.id],
    }
    return { db: withClock({ ...db, batches: [...db.batches, batch] }, key, e) }
  }
  if (existing.rcpt?.includes(e.id)) return { db }
  const newer = isNewer(db, key, e)
  const batches = db.batches.map((b) =>
    b.id === batchId ? { ...b, qtyRemaining: b.qtyRemaining + qty, rcpt: [...(b.rcpt ?? []), e.id], ...(newer ? { costPoisha } : {}) } : b,
  )
  const next = { ...db, batches }
  return { db: newer ? withClock(next, key, e) : next }
}

function applySale(db: Db, e: SyncEvent): Outcome {
  const sale = e.payload.sale as Sale | undefined
  const ledger = e.payload.ledger as LedgerEntry | null | undefined
  if (!isObj(sale) || typeof sale.id !== "string" || !Array.isArray(sale.lines)) return "ignore"
  if (db.sales.some((s) => s.id === sale.id)) return { db }
  const gone = removedIds(db)
  const allocations = sale.lines.flatMap((l) => l.allocations)
  // যে ব্যাচ থেকে বিক্রি, তার স্টক-জমা আগে আসতে হবে (নইলে স্টক ভুল গুনবে)
  if (allocations.some((a) => !gone.has(a.batchId) && !db.batches.some((b) => b.id === a.batchId))) return "defer"
  const batches = db.batches.map((b) => {
    const sold = allocations.filter((a) => a.batchId === b.id).reduce((n, a) => n + a.qty, 0)
    return sold > 0 ? { ...b, qtyRemaining: b.qtyRemaining - sold } : b
  })
  const entries = isObj(ledger) && !db.ledger.some((l) => l.id === ledger.id) ? [ledger as LedgerEntry] : []
  return { db: { ...db, batches, sales: [...db.sales, sale], ledger: [...db.ledger, ...entries] } }
}

function applyVoid(db: Db, e: SyncEvent): Outcome {
  const saleId = e.payload.saleId
  const voided = e.payload.voided as Sale["voided"] | undefined
  const ledger = e.payload.ledger as LedgerEntry | null | undefined
  if (typeof saleId !== "string" || !isObj(voided)) return "ignore"
  const sale = db.sales.find((s) => s.id === saleId)
  if (!sale) return "defer"
  if (sale.voided) {
    // স্টক আগেই ফিরেছে; শুধু কারণ/কে-র তথ্যে শেষ-বদল জেতে
    if (!isNewer(db, `void:${saleId}`, e) && sale.voided.at !== voided.at) return { db }
    return { db: withClock({ ...db, sales: db.sales.map((s) => (s.id === saleId ? { ...s, voided } : s)) }, `void:${saleId}`, e) }
  }
  const back = sale.lines.flatMap((l) => l.allocations)
  const batches = db.batches.map((b) => {
    const qty = back.filter((a) => a.batchId === b.id).reduce((n, a) => n + a.qty, 0)
    return qty > 0 ? { ...b, qtyRemaining: b.qtyRemaining + qty } : b
  })
  const entries = isObj(ledger) && !db.ledger.some((l) => l.id === ledger.id) ? [ledger as LedgerEntry] : []
  const next = { ...db, batches, sales: db.sales.map((s) => (s.id === saleId ? { ...s, voided } : s)), ledger: [...db.ledger, ...entries] }
  return { db: withClock(next, `void:${saleId}`, e) }
}

function applyDue(db: Db, e: SyncEvent): Outcome {
  const entry = e.payload.entry as LedgerEntry | undefined
  if (!isObj(entry) || typeof entry.id !== "string") return "ignore"
  if (db.ledger.some((l) => l.id === entry.id)) return { db }
  return { db: { ...db, ledger: [...db.ledger, entry] } }
}

function applyBatchRemoved(db: Db, e: SyncEvent): Outcome {
  const removed = e.payload.removed as RemovedBatch | undefined
  if (!isObj(removed) || typeof removed.id !== "string") return "ignore"
  const log = db.removedBatches ?? []
  if (log.some((r) => r.id === removed.id)) return { db }
  const batches = removed.batchId ? db.batches.filter((b) => b.id !== removed.batchId) : db.batches
  return { db: { ...db, batches, removedBatches: [...log, removed] } }
}

const APPLIERS: Record<string, (db: Db, e: SyncEvent) => Outcome> = {
  [EVENT_KINDS.product]: applyProduct,
  [EVENT_KINDS.stockIn]: applyStockIn,
  [EVENT_KINDS.customer]: applyCustomer,
  [EVENT_KINDS.sale]: applySale,
  [EVENT_KINDS.saleVoided]: applyVoid,
  [EVENT_KINDS.due]: applyDue,
  [EVENT_KINDS.batchRemoved]: applyBatchRemoved,
  [EVENT_KINDS.settings]: applySettings,
  [EVENT_KINDS.note]: applyNote,
}

/**
 * ইভেন্ট চালিয়ে নতুন Db ফেরায় (পুরনোটা বদলায় না)। একই ইভেন্ট আবার দিলে কিছু বদলায় না;
 * নির্ভরতা না মিললে (যেমন বিলের আগে বাতিল) `deferred`-এ থাকে, পরের দফায় আবার দিতে হবে।
 */
export function applyEvents(db: Db, events: readonly SyncEvent[]): ReplayResult {
  let current = db
  let queue = [...events].sort(compareEvents)
  const ignored: SyncEvent[] = []
  for (;;) {
    const waiting: SyncEvent[] = []
    let progressed = false
    for (const e of queue) {
      const apply = APPLIERS[e.kind]
      const out: Outcome = apply ? apply(current, e) : "ignore"
      if (out === "ignore") ignored.push(e)
      else if (out === "defer") waiting.push(e)
      else {
        current = out.db
        progressed = true
      }
    }
    if (!progressed || waiting.length === 0) return { db: current, deferred: waiting, ignored }
    queue = waiting
  }
}
