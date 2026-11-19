import type { Batch, Db, LedgerEntry, RemovedBatch, Sale } from "../store/types"
import { batchRemovedEvent, customerEvent, dueEvent, productEvent, saleEvent, stockInEvent, voidEvent, type SyncEvent } from "./events"
import { uuidFrom } from "./ids"
import { withClock } from "./replay"

/**
 * সিংক চালুর আগের ডেটা ইভেন্ট করে। id স্থির (ডেটা থেকে বানানো), তাই একই ডেটা দুই ফোন থেকে গেলেও একবারই গোনা হয়।
 * পুরনো ডেটার ঘড়ি `createdAt`/শূন্য সময়ে, যাতে অন্য ফোনের নতুন বদল সবসময় জেতে।
 */
export function seedEvents(db: Db): { events: SyncEvent[]; db: Db } {
  const events: SyncEvent[] = []
  let out = db
  const id = (kind: string, key: string) => uuidFrom(`${kind}:${key}`)

  for (const p of db.products) {
    const e = productEvent(id("product", p.id), p, p.createdAt)
    out = withClock(out, `product:${p.id}`, e)
    events.push(e)
  }
  for (const c of db.customers) {
    const e = customerEvent(id("customer", c.id), c, c.createdAt)
    out = withClock(out, `customer:${c.id}`, e)
    events.push(e)
  }

  // মুছে ফেলা ব্যাচ: পুরনো খাতায় batchId নেই, তাই বিলের (পণ্য, ব্যাচ নম্বর) দিয়ে মেলাই
  const live = new Set(db.batches.map((b) => b.id))
  const removed: RemovedBatch[] = [...(db.removedBatches ?? [])]
  const known = new Set(removed.flatMap((r) => (r.batchId ? [r.batchId] : [])))
  for (const s of db.sales)
    for (const l of s.lines)
      for (const a of l.allocations) {
        if (live.has(a.batchId) || known.has(a.batchId)) continue
        const idx = removed.findIndex((r) => !r.batchId && r.productId === l.productId && r.batchNo === a.batchNo)
        if (idx >= 0) removed[idx] = { ...removed[idx]!, batchId: a.batchId }
        else
          removed.push({
            id: id("legacy-removed", a.batchId),
            at: s.at,
            by: "সিস্টেম",
            batchId: a.batchId,
            productId: l.productId,
            productName: l.name,
            batchNo: a.batchNo,
            expiryDate: null,
            qty: 0,
            costPoisha: a.costPoisha,
            reason: "পুরনো ডেটা (ব্যাচ আগেই মুছে গেছে)",
          })
        known.add(a.batchId)
      }
  out = { ...out, removedBatches: db.removedBatches === undefined && removed.length === 0 ? undefined : removed }
  if (out.removedBatches === undefined) delete (out as { removedBatches?: unknown }).removedBatches
  for (const r of removed) events.push(batchRemovedEvent(id("removed", r.id), r))

  // ব্যাচ: এখনকার পরিমাণ + (বাতিল নয় এমন বিলে বিক্রি) = মূল জমা
  const sold = (b: Batch) =>
    db.sales.filter((s) => !s.voided).reduce((n, s) => n + s.lines.reduce((m, l) => m + l.allocations.filter((a) => a.batchId === b.id).reduce((x, a) => x + a.qty, 0), 0), 0)
  const stockIds = new Map<string, string>()
  for (const b of db.batches) {
    const eid = id("stock", b.id)
    stockIds.set(b.id, eid)
    events.push(stockInEvent(eid, b, b.qtyRemaining + sold(b), b.receivedAt))
  }
  out = { ...out, batches: out.batches.map((b): Batch => ({ ...b, rcpt: [...new Set([...(b.rcpt ?? []), stockIds.get(b.id)!])] })) }

  const saleLedger = (s: Sale, kind: LedgerEntry["kind"]) =>
    db.ledger.find((l) => l.kind === kind && l.saleNo === s.no && l.salePrefix === s.prefix && l.customerId === s.customerId) ?? null
  const handled = new Set<string>()
  const fix = new Map<string, string>()
  for (const s of db.sales) {
    const lg = saleLedger(s, "sale")
    if (lg) handled.add(lg.id)
    const { voided, ...open } = s
    events.push(saleEvent(id("sale", s.id), open as Sale, lg, s.at))
    if (voided) {
      const vl = saleLedger(s, "void")
      if (vl) {
        handled.add(vl.id)
        fix.set(vl.id, `void:${s.id}`)
      }
      events.push(voidEvent(id("void", s.id), s.id, voided, vl))
    }
  }
  if (fix.size) out = { ...out, ledger: out.ledger.map((l) => (fix.has(l.id) ? { ...l, id: fix.get(l.id)! } : l)) }
  for (const l of db.ledger) if (!handled.has(l.id) && (l.kind === "payment" || l.kind === "opening")) events.push(dueEvent(id("due", l.id), l, l.at))
  return { events, db: out }
}
