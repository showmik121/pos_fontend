import { localDateIso } from "../domain/dates"
import type { Db } from "./types"

/**
 * ব্যাকআপ স্মরণ: ডেটা আছে এবং আগের ব্যাকআপের পর (অন্য দিনে) বদল হয়েছে, কিন্তু আজ ব্যাকআপ নেওয়া হয়নি।
 * ফাঁকা বা অপরিবর্তিত দোকানকে বিরক্ত করে না। অবস্থা Db-র বাইরে থাকে, তাই ব্যাকআপ ফেরালে মুছে যায় না।
 */
export interface ReminderState {
  lastBackupAt: string | null
  /** "পরে" চাপা হয়েছে যে স্থানীয় তারিখে (YYYY-MM-DD) */
  snoozedOn: string | null
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">

const EMPTY: ReminderState = { lastBackupAt: null, snoozedOn: null }

export const reminderStorageKey = (storeId: string) => `pos.backup.reminder.v1.${storeId}`

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function parseReminderState(raw: string | null): ReminderState {
  if (!raw) return EMPTY
  try {
    const d = JSON.parse(raw) as Record<string, unknown>
    return {
      lastBackupAt: typeof d.lastBackupAt === "string" ? d.lastBackupAt : null,
      snoozedOn: typeof d.snoozedOn === "string" ? d.snoozedOn : null,
    }
  } catch {
    return EMPTY
  }
}

export function loadReminderState(storeId: string, storage: KeyValueStorage | null = defaultStorage()): ReminderState {
  try {
    return parseReminderState(storage?.getItem(reminderStorageKey(storeId)) ?? null)
  } catch {
    return EMPTY
  }
}

function save(storeId: string, state: ReminderState, storage: KeyValueStorage | null): void {
  try {
    storage?.setItem(reminderStorageKey(storeId), JSON.stringify(state))
  } catch {
    // সেভ না হলে পরের খোলায় আবার মনে করাবে, ক্ষতি নেই
  }
}

export function markBackedUp(storeId: string, now: Date, storage: KeyValueStorage | null = defaultStorage()): void {
  save(storeId, { lastBackupAt: now.toISOString(), snoozedOn: null }, storage)
}

export function snoozeToday(storeId: string, now: Date, storage: KeyValueStorage | null = defaultStorage()): void {
  save(storeId, { ...loadReminderState(storeId, storage), snoozedOn: localDateIso(now) }, storage)
}

function hasAnyData(db: Db): boolean {
  return db.products.length > 0 || db.sales.length > 0 || db.customers.length > 0
}

function changedSince(db: Db, iso: string): boolean {
  const t = Date.parse(iso)
  return db.sales.some((s) => Date.parse(s.at) > t) || db.ledger.some((e) => Date.parse(e.at) > t)
}

export function shouldRemindBackup(db: Db, state: ReminderState, now: Date): boolean {
  if (!hasAnyData(db)) return false
  const today = localDateIso(now)
  if (state.snoozedOn === today) return false
  if (!state.lastBackupAt) return true
  if (localDateIso(new Date(state.lastBackupAt)) === today) return false
  return changedSince(db, state.lastBackupAt)
}
