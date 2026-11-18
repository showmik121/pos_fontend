import type { Db } from "./types"

export const FIRST_BILL_NO = 1000

export function emptyDb(): Db {
  return {
    v: 1,
    products: [],
    batches: [],
    customers: [],
    sales: [],
    ledger: [],
    settings: { expiryDays: [30, 60, 90], defaultMinStock: 5 },
    draft: { lines: [], bill: { type: "amount", value: 0 }, customerId: null },
    billCounter: FIRST_BILL_NO,
  }
}

export const dbStorageKey = (storeId: string) => `pos.db.v1.${storeId}`
const key = dbStorageKey
const backupKey = (storeId: string) => `pos.db.v1.${storeId}.corrupt`

export function isDb(x: unknown): x is Db {
  if (typeof x !== "object" || x === null) return false
  const d = x as Record<string, unknown>
  return (
    d.v === 1 &&
    Array.isArray(d.products) &&
    Array.isArray(d.batches) &&
    Array.isArray(d.customers) &&
    Array.isArray(d.sales) &&
    Array.isArray(d.ledger) &&
    typeof d.settings === "object" &&
    d.settings !== null &&
    typeof d.draft === "object" &&
    d.draft !== null &&
    typeof d.billCounter === "number"
  )
}

// localStorage প্রাইভেট মোড/ব্লকড অবস্থায় ছুঁড়তে পারে, তাই সবখানে try/catch
export function loadDb(storeId: string): Db {
  try {
    const raw = window.localStorage.getItem(key(storeId))
    if (!raw) return emptyDb()
    const parsed: unknown = JSON.parse(raw)
    if (isDb(parsed)) return parsed
    // নষ্ট বা অচেনা ডেটা মুছে না ফেলে আলাদা কপি রেখে নতুন করে শুরু
    window.localStorage.setItem(backupKey(storeId), raw)
  } catch {
    // ফাঁকা থেকে শুরু
  }
  return emptyDb()
}

export function saveDb(storeId: string, db: Db): boolean {
  try {
    window.localStorage.setItem(key(storeId), JSON.stringify(db))
    return true
  } catch {
    return false
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** এই দোকানের ডেটা এখন ব্রাউজারের কত অক্ষর জায়গা নিচ্ছে (পড়া না গেলে 0) */
export function dbStorageChars(storeId: string): number {
  try {
    return window.localStorage.getItem(key(storeId))?.length ?? 0
  } catch {
    return 0
  }
}
