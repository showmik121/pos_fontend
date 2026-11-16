import type { BillDiscount, MobileMethod, Payment } from "../domain/cart"

export type UnitLabel = "piece" | "strip" | "box"
export const UNIT_LABELS: Record<UnitLabel, string> = { piece: "পিস", strip: "পাতা", box: "বক্স" }

export interface ProductBarcode {
  code: string
  /** এই বারকোডে কত পিস (১ = একটি পিস, ১০ = কার্টন) */
  packSize: number
}

export interface Product {
  id: string
  name: string
  barcodes: ProductBarcode[]
  unit: UnitLabel
  /** ১ কার্টনে কত পিস; ১ মানে কার্টন সাইজ ঠিক করা নেই */
  cartonSize: number
  costPoisha: number // প্রতি পিস
  pricePoisha: number // প্রতি পিস
  minStock: number
  category: string
  /** বারকোড ছাড়া "খোলা" পণ্য */
  open: boolean
  createdAt: string
}

export interface Batch {
  id: string
  productId: string
  batchNo: string
  /** মাসের শেষ তারিখ YYYY-MM-DD; null = মেয়াদ নেই */
  expiryDate: string | null
  qtyRemaining: number
  costPoisha: number // প্রতি পিস
  receivedAt: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  createdAt: string
}

export interface SaleAllocation {
  batchId: string
  batchNo: string
  qty: number
  costPoisha: number
}

export interface SaleLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  discount: number
  allocations: SaleAllocation[]
}

export interface Sale {
  id: string
  no: number
  at: string // ISO সময়
  cashier: string
  lines: SaleLine[]
  subtotal: number
  lineDiscount: number
  billDiscount: number
  total: number
  payments: Payment[]
  change: number
  due: number
  customerId: string | null
  customerName: string | null
}

/** বাকির খাতার এন্ট্রি: sale/opening = বাকি বাড়ে, payment = কমে */
export interface LedgerEntry {
  id: string
  customerId: string
  at: string
  kind: "sale" | "opening" | "payment"
  amount: number // সবসময় ধনাত্মক পয়সা
  saleNo: number | null
  by: string
}

export interface Settings {
  /** মেয়াদ অ্যালার্টের সময়সীমা (দিন) */
  expiryDays: number[]
  defaultMinStock: number
}

export interface DraftLine {
  productId: string
  qty: number
  discount: number
}

export interface Draft {
  lines: DraftLine[]
  bill: BillDiscount
  customerId: string | null
}

export interface Db {
  v: 1
  products: Product[]
  batches: Batch[]
  customers: Customer[]
  sales: Sale[]
  ledger: LedgerEntry[]
  settings: Settings
  draft: Draft
  billCounter: number
}

export type { MobileMethod }
