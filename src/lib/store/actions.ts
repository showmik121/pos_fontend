import { tf, tr } from "../i18n"
import { computeCart, settlePayments, type BillDiscount, type MobileMethod } from "../domain/cart"
import { localDateIso } from "../domain/dates"
import { DomainError, requireNonNegativeInt, requirePositiveInt } from "../domain/errors"
import { allocateFifo } from "../domain/fifo"
import { toPieces, type CountUnit } from "../domain/units"
import { normalizeBdPhone } from "../format/phone"
import type { ImportRow } from "./csv"
import { newId } from "./db"
import { addDealerEntry, findDealer } from "./dealers"
import { customerBalance, findByBarcode, findProduct } from "./selectors"
import { lineUnitPrice } from "./line-price"
import { hasVariant, resolveVariant } from "./variants"
import { DOSAGE_FORMS, PHARMA_TEXT_MAX, type Batch, type Customer, type Db, type Draft, type DosageForm, type LedgerEntry, type Product, type RemovedBatch, type Sale, type SaleLine, type UnitLabel } from "./types"

// সব ফাংশন বিশুদ্ধ: পুরনো Db বদলায় না, নতুন Db ফেরত দেয়। ব্যর্থ হলে DomainError ছোঁড়ে।

export interface ProductInput {
  name: string
  unit: UnitLabel
  cartonSize: number
  /** ১ পাতায় কত পিস; ১/না দিলে পাতা-ধাপ নেই */
  stripSize?: number
  costPoisha: number
  pricePoisha: number
  minStock: number
  category: string
  /** ফার্মেসির ঐচ্ছিক ঘর; ফাঁকা/না দিলে পণ্যে লেখা হয় না */
  generic?: string
  strength?: string
  form?: DosageForm | null
  company?: string
  /** শেড/সাইজের লেবেল; দিলে `name` ফ্যামিলির নাম ধরা হয় আর পণ্যের নাম হয় "ফ্যামিলি · ভ্যারিয়েন্ট" */
  variant?: string
  barcode: string | null
  open: boolean
}

/** ঐচ্ছিক ওষুধের তথ্য ছেঁটে নেয়; ফাঁকা ঘর বাদ যায় যাতে পুরনো পণ্যের আকার বদলায় না */
function pharmaFields(input: Pick<ProductInput, "generic" | "strength" | "form" | "company" | "stripSize">): Pick<Product, "generic" | "strength" | "form" | "company" | "stripSize"> {
  const out: Pick<Product, "generic" | "strength" | "form" | "company" | "stripSize"> = {}
  if (input.stripSize && input.stripSize > 1) out.stripSize = input.stripSize
  const generic = input.generic?.trim()
  const strength = input.strength?.trim()
  const company = input.company?.trim()
  if (generic) out.generic = generic
  if (strength) out.strength = strength
  if (input.form) out.form = input.form
  if (company) out.company = company
  return out
}

function validateProductFields(input: ProductInput): void {
  if (!input.name.trim()) throw new DomainError("name_required", tr("পণ্যের নাম দিন"))
  if (!(input.pricePoisha > 0)) throw new DomainError("price_required", tr("বিক্রয়মূল্য দিন"))
  requireNonNegativeInt(input.costPoisha, "ক্রয়মূল্য")
  requirePositiveInt(input.cartonSize, "কার্টনে পিসের সংখ্যা")
  if (input.stripSize !== undefined) requirePositiveInt(input.stripSize, "পাতায় পিসের সংখ্যা")
  requireNonNegativeInt(input.minStock, "সর্বনিম্ন স্টক")
  if ((input.generic?.trim().length ?? 0) > PHARMA_TEXT_MAX.generic) throw new DomainError("generic_too_long", tr("জেনেরিক নাম বেশি লম্বা"))
  if ((input.strength?.trim().length ?? 0) > PHARMA_TEXT_MAX.strength) throw new DomainError("strength_too_long", tr("শক্তি বেশি লম্বা (যেমন ৫০০ mg)"))
  if ((input.company?.trim().length ?? 0) > PHARMA_TEXT_MAX.company) throw new DomainError("company_too_long", tr("কোম্পানির নাম বেশি লম্বা"))
  if (input.form && !Object.prototype.hasOwnProperty.call(DOSAGE_FORMS, input.form)) throw new DomainError("form_invalid", tr("ওষুধের ধরন সঠিক নয়"))
}

export function createProduct(db: Db, input: ProductInput, now: Date): { db: Db; product: Product } {
  validateProductFields(input)
  const code = input.barcode?.trim() || null
  if (code && findByBarcode(db, code)) throw new DomainError("duplicate_barcode", tr("এই বারকোড আগে থেকেই আছে"))
  const named = resolveVariant(input)
  if (named.family && named.variant && hasVariant(db, named.family, named.variant)) throw new DomainError("duplicate_variant", tr("এই ভ্যারিয়েন্ট আগে থেকেই আছে"))
  const product: Product = {
    id: newId(),
    ...named,
    barcodes: code ? [{ code, packSize: 1 }] : [],
    unit: input.unit,
    cartonSize: input.cartonSize,
    costPoisha: input.costPoisha,
    pricePoisha: input.pricePoisha,
    minStock: input.minStock,
    category: input.category.trim(),
    ...pharmaFields(input),
    open: input.open && !code,
    createdAt: now.toISOString(),
  }
  return { db: { ...db, products: [...db.products, product] }, product }
}

export function updateProduct(db: Db, id: string, input: Omit<ProductInput, "barcode" | "open">): Db {
  validateProductFields({ ...input, barcode: null, open: false })
  if (!findProduct(db, id)) throw new DomainError("not_found", tr("পণ্যটি পাওয়া যায়নি"))
  const named = resolveVariant(input)
  if (named.family && named.variant && hasVariant(db, named.family, named.variant, id)) throw new DomainError("duplicate_variant", tr("এই ভ্যারিয়েন্ট আগে থেকেই আছে"))
  return {
    ...db,
    products: db.products.map((p) => {
      if (p.id !== id) return p
      // পুরনো ওষুধের তথ্য ও ভ্যারিয়েন্ট সরিয়ে নতুনটা বসে, তাই ঘর ফাঁকা করলে তথ্য মুছে যায়
      const { generic: _g, strength: _s, form: _f, company: _c, stripSize: _z, family: _fa, variant: _v, ...rest } = p
      return { ...rest, ...named, unit: input.unit, cartonSize: input.cartonSize, costPoisha: input.costPoisha, pricePoisha: input.pricePoisha, minStock: input.minStock, category: input.category.trim(), ...pharmaFields(input) }
    }),
  }
}

export function addBarcode(db: Db, productId: string, code: string, packSize: number): Db {
  const c = code.trim()
  if (!c) throw new DomainError("barcode_required", tr("বারকোড ফাঁকা"))
  requirePositiveInt(packSize, "কার্টনে পিসের সংখ্যা")
  if (!findProduct(db, productId)) throw new DomainError("not_found", tr("পণ্যটি পাওয়া যায়নি"))
  if (findByBarcode(db, c)) throw new DomainError("duplicate_barcode", tr("এই বারকোড আগে থেকেই আছে"))
  return {
    ...db,
    products: db.products.map((p) => (p.id === productId ? { ...p, open: false, barcodes: [...p.barcodes, { code: c, packSize }] } : p)),
  }
}

export interface StockInInput {
  productId: string
  qty: number
  unit: CountUnit
  batchNo: string
  expiryDate: string | null
  /** unit অনুযায়ী প্রতি কার্টন বা প্রতি পিসের ক্রয়মূল্য (পয়সা) */
  costPoisha: number
  /** প্রতি পিস বিক্রয়মূল্য; null হলে আগেরটাই থাকে */
  pricePoisha: number | null
  /** ফার্মেসিতে ব্যাচ ও মেয়াদ বাধ্যতামূলক */
  requireBatchAndExpiry: boolean
  /** true হলে ব্যাচ নম্বর খালি থাকতে পারে (মেয়াদ তবু বাধ্যতামূলক); দোকানদারের টাইপ কমাতে */
  batchOptional?: boolean
  /** সিংক ইভেন্টের id; দিলে ব্যাচের `rcpt`-এ লেখা হয় */
  receiptId?: string
}

export function stockIn(db: Db, input: StockInInput, now: Date): Db {
  const product = findProduct(db, input.productId)
  if (!product) throw new DomainError("not_found", tr("পণ্যটি পাওয়া যায়নি"))
  const pieces = toPieces({ qty: input.qty, unit: input.unit, stripSize: product.stripSize ?? 1, cartonSize: product.cartonSize })
  requireNonNegativeInt(input.costPoisha, "ক্রয়মূল্য")
  const batchNo = input.batchNo.trim()
  if (input.requireBatchAndExpiry) {
    if (!batchNo && !input.batchOptional) throw new DomainError("batch_required", tr("ব্যাচ নম্বর দিন"))
    if (!input.expiryDate) throw new DomainError("expiry_required", tr("মেয়াদ দিন (মাস/বছর)"))
  }
  const costPerPiece = input.unit === "carton" ? Math.round(input.costPoisha / product.cartonSize) : input.unit === "strip" ? Math.round(input.costPoisha / (product.stripSize ?? 1)) : input.costPoisha
  const nowIso = now.toISOString()

  const existing = db.batches.find((b) => b.productId === product.id && b.batchNo === batchNo && b.expiryDate === input.expiryDate && batchNo !== "")
  const rid = input.receiptId
  const batches: Batch[] = existing
    ? db.batches.map((b) => (b.id === existing.id ? { ...b, qtyRemaining: b.qtyRemaining + pieces, costPoisha: costPerPiece, ...(rid ? { rcpt: [...(b.rcpt ?? []), rid] } : {}) } : b))
    : [...db.batches, { id: newId(), productId: product.id, batchNo, expiryDate: input.expiryDate, qtyRemaining: pieces, costPoisha: costPerPiece, receivedAt: nowIso, ...(rid ? { rcpt: [rid] } : {}) }]

  const price = input.pricePoisha != null && input.pricePoisha > 0 ? input.pricePoisha : product.pricePoisha
  const products = db.products.map((p) => (p.id === product.id ? { ...p, costPoisha: costPerPiece, pricePoisha: price } : p))
  return { ...db, batches, products }
}

/** ব্যাচ স্টক থেকে সরায় এবং কে, কখন, কেন, কত পিস সরালো তা `removedBatches` খাতায় লেখে (স্টক চুপচাপ উধাও হয় না) */
export function removeBatch(db: Db, batchId: string, input: { by: string; reason: string }, now: Date): Db {
  const batch = db.batches.find((b) => b.id === batchId)
  if (!batch) return db
  const reason = input.reason.trim()
  if (!reason) throw new DomainError("reason_required", tr("সরানোর কারণ বাছুন"))
  return withoutBatch(db, batch, { by: input.by, reason }, now)
}

function withoutBatch(db: Db, batch: Batch, input: { by: string; reason: string }, now: Date, extra: Partial<RemovedBatch> = {}): Db {
  const entry: RemovedBatch = {
    id: newId(),
    at: now.toISOString(),
    by: input.by,
    batchId: batch.id,
    productId: batch.productId,
    productName: db.products.find((p) => p.id === batch.productId)?.name ?? "মুছে ফেলা পণ্য",
    batchNo: batch.batchNo,
    expiryDate: batch.expiryDate,
    qty: batch.qtyRemaining,
    costPoisha: batch.costPoisha,
    reason: input.reason,
    ...extra,
  }
  return { ...db, batches: db.batches.filter((b) => b.id !== batch.id), removedBatches: [...(db.removedBatches ?? []), entry] }
}

export const RETURN_REASON = "ডিলারে ফেরত"

/**
 * মেয়াদ থাকতেই ব্যাচ ডিলার/কোম্পানিতে ফেরত দেয়: ব্যাচ স্টক থেকে যায়, সরানোর খাতায় "ফেরত" হিসেবে লেখা হয়,
 * আর ক্রেডিট থাকলে ডিলারের খাতায় জমা (payment) বসে, ফলে ডিলারকে দেওয়া পাওনা কমে। ক্রেডিট ০ হলে (বদলে মাল পাবেন) খাতায় কিছু বসে না।
 */
export function returnBatchToDealer(
  db: Db,
  batchId: string,
  input: { dealerId: string; creditPoisha: number; by: string },
  now: Date,
): Db {
  const batch = db.batches.find((b) => b.id === batchId)
  if (!batch) throw new DomainError("batch_not_found", tr("ব্যাচটি পাওয়া যায়নি"))
  const dealer = findDealer(db, input.dealerId)
  if (!dealer) throw new DomainError("dealer_not_found", tr("ডিলার বাছুন"))
  if (!Number.isInteger(input.creditPoisha) || input.creditPoisha < 0) throw new DomainError("invalid_credit", tr("ক্রেডিটের টাকা সঠিক নয়"))
  const removed = withoutBatch(db, batch, { by: input.by, reason: RETURN_REASON }, now, {
    returnedToDealerId: dealer.id,
    returnedToDealerName: dealer.name,
    creditPoisha: input.creditPoisha,
  })
  if (input.creditPoisha === 0) return removed
  const productName = db.products.find((p) => p.id === batch.productId)?.name ?? ""
  const note = tf("ফেরত: {p0}{p1}", { p0: productName, p1: batch.batchNo ? ` (${batch.batchNo})` : "" })
  return addDealerEntry(removed, dealer.id, { kind: "payment", amount: input.creditPoisha, date: localDateIso(now), note }, input.by, now)
}

// ---- কার্ট (খসড়া বিল) ----

export function addToCart(draft: Draft, productId: string, qty = 1): Draft {
  requirePositiveInt(qty, "পরিমাণ")
  const has = draft.lines.some((l) => l.productId === productId)
  const lines = has
    ? draft.lines.map((l) => (l.productId === productId ? { ...l, qty: l.qty + qty } : l))
    : [...draft.lines, { productId, qty, discount: 0 }]
  return { ...draft, lines }
}

export function setCartQty(draft: Draft, productId: string, qty: number): Draft {
  if (qty <= 0) return { ...draft, lines: draft.lines.filter((l) => l.productId !== productId) }
  return { ...draft, lines: draft.lines.map((l) => (l.productId === productId ? { ...l, qty } : l)) }
}

/** শুধু এই বিলের একটি লাইনের প্রতি-পিস দাম বদলায় (null = পণ্যের দামে ফেরে); ছাড় দামের বেশি হয়ে গেলে ছাড় কমে দামের সমান হয় */
export function setCartLinePrice(draft: Draft, productId: string, unitPrice: number | null): Draft {
  if (unitPrice != null && (!Number.isInteger(unitPrice) || unitPrice < 1)) throw new DomainError("invalid_price", tr("দাম ১ পয়সা বা তার বেশি হতে হবে"))
  return {
    ...draft,
    lines: draft.lines.map((l) => {
      if (l.productId !== productId) return l
      const { unitPrice: _old, ...rest } = l
      return unitPrice == null ? rest : { ...rest, unitPrice }
    }),
  }
}

/** পণ্যের তালিকা-দাম (প্রতি পিস) বদলায়; বিলের সময় "পণ্যের দামও বদলান" বাছলে চলে */
export function setProductPrice(db: Db, productId: string, pricePoisha: number): Db {
  if (!Number.isInteger(pricePoisha) || pricePoisha < 1) throw new DomainError("invalid_price", tr("দাম ১ পয়সা বা তার বেশি হতে হবে"))
  if (!findProduct(db, productId)) throw new DomainError("not_found", tr("পণ্যটি পাওয়া যায়নি"))
  return { ...db, products: db.products.map((p) => (p.id === productId ? { ...p, pricePoisha } : p)) }
}

export function setLineDiscounts(draft: Draft, discounts: Record<string, number>): Draft {
  return { ...draft, lines: draft.lines.map((l) => ({ ...l, discount: discounts[l.productId] ?? l.discount })) }
}

export function setBillDiscount(draft: Draft, bill: BillDiscount): Draft {
  return { ...draft, bill }
}

export function setCartCustomer(draft: Draft, customerId: string | null): Draft {
  return { ...draft, customerId }
}

export const EMPTY_DRAFT: Draft = { lines: [], bill: { type: "amount", value: 0 }, customerId: null }

// ---- বিল সম্পন্ন ----

export interface CompleteSaleInput {
  cashier: string
  cash: number
  mobile: number
  mobileMethod: MobileMethod
  /** এই ফোনের ডিভাইস কোড; নিবন্ধিত না হলে বাদ */
  devicePrefix?: string | null
}

export function completeSale(db: Db, input: CompleteSaleInput, now: Date): { db: Db; sale: Sale } {
  const draft = db.draft
  if (draft.lines.length === 0) throw new DomainError("empty_cart", tr("বিলে কমপক্ষে একটি পণ্য লাগবে"))
  const today = localDateIso(now)

  const priced = draft.lines.map((l) => {
    const product = findProduct(db, l.productId)
    if (!product) throw new DomainError("not_found", tr("কার্টের একটি পণ্য আর পাওয়া যাচ্ছে না"))
    return { line: l, product }
  })
  const totals = computeCart(
    priced.map(({ line, product }) => ({ unitPrice: lineUnitPrice(line, product), qty: line.qty, discount: line.discount })),
    draft.bill,
  )
  const customer = draft.customerId ? db.customers.find((c) => c.id === draft.customerId) : undefined
  const settled = settlePayments({ total: totals.total, cash: input.cash, mobile: input.mobile, mobileMethod: input.mobileMethod, hasCustomer: customer != null })

  let batches = db.batches
  const lines: SaleLine[] = priced.map(({ line, product }) => {
    const productBatches = batches.filter((b) => b.productId === product.id)
    const allocs = allocateFifo(productBatches, line.qty, today)
    batches = batches.map((b) => {
      const a = allocs.find((x) => x.batchId === b.id)
      return a ? { ...b, qtyRemaining: b.qtyRemaining - a.qty } : b
    })
    return {
      productId: product.id,
      name: product.name,
      qty: line.qty,
      unitPrice: lineUnitPrice(line, product),
      discount: line.discount,
      allocations: allocs.map((a) => {
        const b = productBatches.find((x) => x.id === a.batchId)
        return { batchId: a.batchId, batchNo: b?.batchNo ?? "", qty: a.qty, costPoisha: b?.costPoisha ?? product.costPoisha }
      }),
    }
  })

  const no = db.billCounter + 1
  const sale: Sale = {
    id: newId(),
    no,
    ...(input.devicePrefix ? { prefix: input.devicePrefix } : {}),
    at: now.toISOString(),
    cashier: input.cashier,
    lines,
    subtotal: totals.subtotal,
    lineDiscount: totals.lineDiscount,
    billDiscount: totals.billDiscount,
    total: totals.total,
    payments: settled.payments,
    change: settled.change,
    due: settled.due,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? null,
  }
  const ledger: LedgerEntry[] =
    settled.due > 0 && customer
      ? [...db.ledger, { id: newId(), customerId: customer.id, at: sale.at, kind: "sale", amount: settled.due, saleNo: no, ...(sale.prefix ? { salePrefix: sale.prefix } : {}), by: input.cashier }]
      : db.ledger
  return {
    db: { ...db, batches, sales: [...db.sales, sale], ledger, billCounter: no, draft: EMPTY_DRAFT },
    sale,
  }
}

// ---- বিল বাতিল ----

export interface VoidResult {
  db: Db
  /** ব্যাচে ফেরত গেল এত পিস */
  restoredQty: number
  /** ব্যাচ আগেই মুছে ফেলা হয়েছিল বলে ফেরানো যায়নি এত পিস (মেয়াদ অজানা, তাই নতুন ব্যাচ বানানো হয় না) */
  lostQty: number
  /** কাস্টমারকে ফেরত দিতে হবে এত পয়সা (বিলের সময় নেওয়া টাকা + পরে শোধ করা বাকি) */
  refundPoisha: number
}

export function voidSale(db: Db, saleId: string, input: { by: string; reason: string }, now: Date): VoidResult {
  const sale = db.sales.find((s) => s.id === saleId)
  if (!sale) throw new DomainError("not_found", tr("বিলটি পাওয়া যায়নি"))
  if (sale.voided) throw new DomainError("already_voided", tr("এই বিল আগেই বাতিল করা হয়েছে"))
  const reason = input.reason.trim()
  if (!reason) throw new DomainError("reason_required", tr("বাতিলের কারণ লিখুন"))

  let restoredQty = 0
  let lostQty = 0
  let batches = db.batches
  for (const line of sale.lines) {
    for (const a of line.allocations) {
      if (batches.some((b) => b.id === a.batchId)) {
        batches = batches.map((b) => (b.id === a.batchId ? { ...b, qtyRemaining: b.qtyRemaining + a.qty } : b))
        restoredQty += a.qty
      } else lostQty += a.qty
    }
  }

  let ledger = db.ledger
  let dueReversed = 0
  if (sale.due > 0 && sale.customerId) {
    // কাস্টমার পরে কিছু বাকি শোধ করে থাকলে সেটুকু ঋণাত্মক বাকি না বানিয়ে ফেরতের হিসাবে যায়
    dueReversed = Math.min(sale.due, Math.max(0, customerBalance(db, sale.customerId)))
    if (dueReversed > 0) {
      ledger = [...ledger, { id: newId(), customerId: sale.customerId, at: now.toISOString(), kind: "void", amount: dueReversed, saleNo: sale.no, ...(sale.prefix ? { salePrefix: sale.prefix } : {}), by: input.by }]
    }
  }
  const refundPoisha = sale.total - sale.due + (sale.due - dueReversed)

  const sales = db.sales.map((s) => (s.id === saleId ? { ...s, voided: { at: now.toISOString(), by: input.by, reason } } : s))
  return { db: { ...db, batches, sales, ledger }, restoredQty, lostQty, refundPoisha }
}

// ---- কাস্টমার ও বাকি ----

export function addCustomer(db: Db, input: { name: string; phone: string }, now: Date): { db: Db; customer: Customer } {
  const name = input.name.trim()
  if (!name) throw new DomainError("name_required", tr("কাস্টমারের নাম দিন"))
  let phone = ""
  if (input.phone.trim()) {
    const normalized = normalizeBdPhone(input.phone)
    if (!normalized) throw new DomainError("invalid_phone", tr("মোবাইল নম্বর সঠিক নয় (যেমন ০১৭১২৩৪৫৬৭৮)"))
    if (db.customers.some((c) => c.phone === normalized)) throw new DomainError("duplicate_phone", tr("এই নম্বরে কাস্টমার আগে থেকেই আছে"))
    phone = normalized
  }
  const customer: Customer = { id: newId(), name, phone, createdAt: now.toISOString() }
  return { db: { ...db, customers: [...db.customers, customer] }, customer }
}

/** কাস্টমারের বাকির সীমা বসায় (পয়সায়, > ০); null হলে সীমা তুলে দেয় */
export function setCreditLimit(db: Db, customerId: string, limit: number | null): Db {
  if (!db.customers.some((c) => c.id === customerId)) throw new DomainError("customer_not_found", tr("কাস্টমার পাওয়া যায়নি"))
  if (limit !== null) requirePositiveInt(limit, "বাকির সীমা")
  return { ...db, customers: db.customers.map((c) => (c.id === customerId ? { ...c, creditLimit: limit } : c)) }
}

/** আদায়ের প্রতিশ্রুতির তারিখ বসায় (আজ বা পরে); date = null হলে মুছে দেয় */
export function setPromise(db: Db, customerId: string, date: string | null, note: string, now: Date): Db {
  const customer = db.customers.find((c) => c.id === customerId)
  if (!customer) throw new DomainError("customer_not_found", tr("কাস্টমার পাওয়া যায়নি"))
  let promise: Customer["promise"] = null
  if (date !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new DomainError("invalid_date", tr("তারিখ সঠিক নয়"))
    if (date < localDateIso(now)) throw new DomainError("past_date", tr("আজ বা পরের তারিখ দিন"))
    promise = { date, note: note.trim().slice(0, 120) }
  }
  return { ...db, customers: db.customers.map((c) => (c.id === customerId ? { ...c, promise } : c)) }
}

export function receiveDue(db: Db, customerId: string, amount: number, by: string, now: Date): Db {
  requirePositiveInt(amount, "জমার পরিমাণ")
  if (!db.customers.some((c) => c.id === customerId)) throw new DomainError("not_found", tr("কাস্টমার পাওয়া যায়নি"))
  if (amount > customerBalance(db, customerId)) throw new DomainError("overpay", tr("বাকির চেয়ে বেশি জমা নেওয়া যায় না"))
  const entry: LedgerEntry = { id: newId(), customerId, at: now.toISOString(), kind: "payment", amount, saleNo: null, by }
  return { ...db, ledger: [...db.ledger, entry] }
}

export function updateSettings(db: Db, patch: Partial<Db["settings"]>): Db {
  return { ...db, settings: { ...db.settings, ...patch } }
}

export function importProducts(db: Db, rows: readonly ImportRow[], now: Date): Db {
  let next = db
  for (const r of rows) {
    const created = createProduct(
      next,
      { name: r.name, unit: r.unit, cartonSize: r.cartonSize, costPoisha: r.costPoisha, pricePoisha: r.pricePoisha, minStock: r.minStock, category: r.category, stripSize: r.stripSize, generic: r.generic, strength: r.strength, form: r.form, company: r.company, barcode: r.barcode || null, open: !r.barcode },
      now,
    )
    next = created.db
    if (r.qty > 0) {
      next = stockIn(next, { productId: created.product.id, qty: r.qty, unit: "piece", batchNo: r.batchNo, expiryDate: r.expiryDate, costPoisha: r.costPoisha, pricePoisha: null, requireBatchAndExpiry: false }, now)
    }
  }
  return next
}
