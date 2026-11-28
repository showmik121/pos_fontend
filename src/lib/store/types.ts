import type { BillDiscount, MobileMethod, Payment } from "../domain/cart"

export type UnitLabel = "piece" | "strip" | "box"
export const UNIT_LABELS: Record<UnitLabel, string> = { piece: "পিস", strip: "পাতা", box: "বক্স" }

/** ওষুধের ধরন (ফার্মেসির পণ্যে ঐচ্ছিক) */
export type DosageForm = "tablet" | "capsule" | "syrup" | "injection" | "drop" | "cream" | "inhaler" | "saline" | "other"
export const DOSAGE_FORMS: Record<DosageForm, string> = {
  tablet: "ট্যাবলেট",
  capsule: "ক্যাপসুল",
  syrup: "সিরাপ",
  injection: "ইনজেকশন",
  drop: "ড্রপ",
  cream: "ক্রিম/মলম",
  inhaler: "ইনহেলার",
  saline: "স্যালাইন/পাউডার",
  other: "অন্যান্য",
}
export const PHARMA_TEXT_MAX = { generic: 120, strength: 40, company: 120 } as const
/** ভ্যারিয়েন্ট (শেড/সাইজ) লেখার সীমা: ফ্যামিলির নাম ও ভ্যারিয়েন্টের লেবেল */
export const VARIANT_TEXT_MAX = { family: 120, variant: 60 } as const

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
  /** ১ পাতায় কত পিস (ট্যাবলেট/ক্যাপসুল); ফার্মেসিতে ঐচ্ছিক, না থাকলে পাতা-ধাপ নেই */
  stripSize?: number
  costPoisha: number // প্রতি পিস
  pricePoisha: number // প্রতি পিস
  minStock: number
  category: string
  /** জেনেরিক নাম (যেমন Paracetamol); ফার্মেসির পণ্যে ঐচ্ছিক, পুরনো ডেটায় নেই */
  generic?: string
  /** শক্তি (যেমন 500 mg) */
  strength?: string
  /** ওষুধের ধরন */
  form?: DosageForm
  /** কোম্পানি/প্রস্তুতকারক */
  company?: string
  /** ভ্যারিয়েন্টের ফ্যামিলি (যেমন "Ponds Cream"); `variant` থাকলে `name` = "ফ্যামিলি · ভ্যারিয়েন্ট", পুরনো ডেটায় নেই */
  family?: string
  /** শেড বা সাইজের লেবেল (যেমন "৫০ml", "শেড ০২") */
  variant?: string
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
  /** যেসব স্টক-জমা ইভেন্ট এই ব্যাচে পরিমাণ যোগ করেছে (সিংকে একই জমা দুবার না ধরার জন্য); সিংক-পূর্ব ডেটায় নেই */
  rcpt?: string[]
}

export interface Customer {
  id: string
  name: string
  phone: string
  createdAt: string
  /** আদায়ের প্রতিশ্রুতি: কাস্টমার কবে বাকি দেবে (তারিখ YYYY-MM-DD); পুরনো ডেটায় নেই */
  promise?: { date: string; note: string } | null
  /** বাকির সীমা (পয়সায়); null বা নেই = সীমা নেই */
  creditLimit?: number | null
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
  /** ডিভাইস-উপসর্গ (A–Z); নিবন্ধনের আগের বিলে নেই */
  prefix?: string
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
  /** বাতিল হলে কখন, কে, কেন; বাতিল বিল স্টক ও রিপোর্টে আর ধরা হয় না */
  voided?: { at: string; by: string; reason: string }
}

/** বাকির খাতার এন্ট্রি: sale/opening = বাকি বাড়ে, payment/void = কমে (void = বিল বাতিলে বাকি ফেরানো) */
export interface LedgerEntry {
  id: string
  customerId: string
  at: string
  kind: "sale" | "opening" | "payment" | "void"
  amount: number // সবসময় ধনাত্মক পয়সা
  saleNo: number | null
  salePrefix?: string
  by: string
}

/** স্টক থেকে সরানো ব্যাচের হিসাব (মেয়াদ শেষ, নষ্ট ইত্যাদি); মুছে গেলেও কত পিস ও কত টাকার ক্ষতি তা থাকে */
export interface RemovedBatch {
  id: string
  at: string
  by: string
  /** সরানো ব্যাচের id; সিংকে পরে আসা স্টক-জমা ইভেন্ট যেন ব্যাচ ফেরত না আনে; পুরনো ডেটায় নেই */
  batchId?: string
  productId: string
  productName: string
  batchNo: string
  expiryDate: string | null
  qty: number
  costPoisha: number // প্রতি পিস
  reason: string
  /** ডিলারে ফেরত দিলে: কোন ডিলার ও কত টাকা ক্রেডিট পাওয়া গেল (পয়সায়); সাধারণ সরানোয় নেই */
  returnedToDealerId?: string
  returnedToDealerName?: string
  creditPoisha?: number
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
  /** শুধু এই বিলের জন্য বদলানো প্রতি-পিস দাম (পয়সা); না থাকলে পণ্যের দাম */
  unitPrice?: number
}

export interface Draft {
  lines: DraftLine[]
  bill: BillDiscount
  customerId: string | null
}

/** বিক্রেতার নোট: কী আনতে হবে (স্টক শেষ / কাস্টমার চেয়েছে) */
export interface Note {
  id: string
  text: string
  kind: "out" | "request" | "other"
  /** কোন কাস্টমার চেয়েছে (লেখা, ঐচ্ছিক) */
  customerName: string
  /** স্টক শেষের তালিকা থেকে তুললে ওই পণ্যের id (একই পণ্য দুবার না তোলার জন্য) */
  productId?: string
  done: boolean
  /** মুছলে true (সিংকে শেষ-বদল জেতার জন্য আসল মোছা হয় না) */
  deleted?: boolean
  createdAt: string
}

/** খরচের ক্যাটেগরি (বেতন, ভাড়া ইত্যাদি) */
export interface ExpenseCategory {
  id: string
  name: string
  /** একটি ইমোজি */
  icon: string
  /** মুছলে true (সিংকে শেষ-বদল জেতার জন্য আসল মোছা হয় না); পুরনো খরচ খাতায় থাকে */
  deleted?: boolean
  createdAt: string
}

/** দোকানের একটি খরচ; amount পয়সায় */
export interface Expense {
  id: string
  categoryId: string
  amount: number
  note: string
  /** খরচের তারিখ YYYY-MM-DD */
  date: string
  /** এন্ট্রি করার সময় */
  at: string
  by: string
  deleted?: boolean
}

/** ডিলার/সাপ্লায়ার, যার কাছ থেকে দোকানি মাল কেনে */
export interface Dealer {
  id: string
  name: string
  /** ঐচ্ছিক; ফাঁকা হলে "" */
  phone: string
  createdAt: string
  /** মুছলে true (সিংকে শেষ-বদল জেতার জন্য আসল মোছা হয় না) */
  deleted?: boolean
}

/** ডিলারের খাতার একটি লেনদেন: purchase = বাকিতে মাল নেওয়া (পাওনা বাড়ে), payment = টাকা দেওয়া (পাওনা কমে); amount পয়সায় */
export interface DealerEntry {
  id: string
  dealerId: string
  kind: "purchase" | "payment"
  amount: number
  /** লেনদেনের তারিখ YYYY-MM-DD */
  date: string
  /** শুধু purchase-এ: কবে টাকা দিতে হবে (ঐচ্ছিক) */
  dueDate?: string
  note: string
  /** এন্ট্রি করার সময় */
  at: string
  by: string
  deleted?: boolean
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
  /** সরানো ব্যাচের খাতা; পুরনো ডেটায় নেই (ঐচ্ছিক), তাই মাইগ্রেশন লাগে না */
  removedBatches?: RemovedBatch[]
  /** বিক্রেতার নোট; পুরনো ডেটায় নেই */
  notes?: Note[]
  /** খরচের ক্যাটেগরি ও খরচ; পুরনো ডেটায় নেই (ক্যাটেগরি undefined = এখনো ডিফল্ট বসেনি) */
  expenseCategories?: ExpenseCategory[]
  expenses?: Expense[]
  /** ডিলারের পাওনা খাতা; পুরনো ডেটায় নেই */
  dealers?: Dealer[]
  dealerEntries?: DealerEntry[]
  /** সিংক-মেটা: শেষ-বদল-জেতে ঘড়ি। কী = এন্টিটি-গ্রুপ, মান = "<at>|<ইভেন্ট id>"; পুরনো ডেটায় নেই */
  sync?: { clocks: Record<string, string> }
}

export type { MobileMethod }
