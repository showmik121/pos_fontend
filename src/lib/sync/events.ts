import type { Batch, Customer, Db, LedgerEntry, Note, Product, RemovedBatch, Sale } from "../store/types"

/** সার্ভারের ইভেন্ট চুক্তি: id (UUID), kind, at (ISO), payload (JSON অবজেক্ট) */
export interface SyncEvent {
  id: string
  kind: string
  at: string
  payload: Record<string, unknown>
}

export const EVENT_KINDS = {
  product: "product_upserted",
  stockIn: "stock_in",
  customer: "customer_upserted",
  sale: "sale_completed",
  saleVoided: "sale_voided",
  due: "due_received",
  batchRemoved: "batch_removed",
  settings: "settings_updated",
  note: "note_upserted",
} as const

const make = (id: string, kind: string, at: Date | string, payload: Record<string, unknown>): SyncEvent => ({
  id,
  kind,
  at: typeof at === "string" ? at : at.toISOString(),
  payload,
})

/** পণ্য তৈরি বা বদল: পুরো স্ন্যাপশট; শেষ-বদল জেতে */
export const productEvent = (id: string, product: Product, at: Date | string) => make(id, EVENT_KINDS.product, at, { product })

/** স্টক-জমা: `qty` = এই জমায় যত পিস যোগ হলো (ব্যাচের মোট নয়) */
export const stockInEvent = (id: string, batch: Batch, qty: number, at: Date | string) =>
  make(id, EVENT_KINDS.stockIn, at, {
    batchId: batch.id,
    productId: batch.productId,
    batchNo: batch.batchNo,
    expiryDate: batch.expiryDate,
    qty,
    costPoisha: batch.costPoisha,
    receivedAt: batch.receivedAt,
  })

export const customerEvent = (id: string, customer: Customer, at: Date | string) => make(id, EVENT_KINDS.customer, at, { customer })

/** বিক্রি: বিলের স্ন্যাপশট + (বাকি থাকলে) খাতার এন্ট্রি */
export const saleEvent = (id: string, sale: Sale, ledger: LedgerEntry | null, at: Date | string) =>
  make(id, EVENT_KINDS.sale, at, { sale, ledger })

/** বিল বাতিল; বাকি ফেরানোর এন্ট্রির id নির্দিষ্ট (`void:<saleId>`), যাতে দুই ডিভাইসে বাতিল হলেও বাকি একবারই কমে */
export const voidEvent = (
  id: string,
  saleId: string,
  voided: { at: string; by: string; reason: string },
  ledger: LedgerEntry | null,
) =>
  make(id, EVENT_KINDS.saleVoided, voided.at, {
    saleId,
    voided,
    ledger: ledger ? { ...ledger, id: `void:${saleId}` } : null,
  })

export const dueEvent = (id: string, entry: LedgerEntry, at: Date | string) => make(id, EVENT_KINDS.due, at, { entry })

export const batchRemovedEvent = (id: string, removed: RemovedBatch) => make(id, EVENT_KINDS.batchRemoved, removed.at, { removed })

export const settingsEvent = (id: string, settings: Db["settings"], at: Date | string) => make(id, EVENT_KINDS.settings, at, { settings })

/** নোট তৈরি বা বদল (পুরো স্ন্যাপশট; মোছাও এভাবে); শেষ-বদল জেতে */
export const noteEvent = (id: string, note: Note, at: Date | string) => make(id, EVENT_KINDS.note, at, { note })
