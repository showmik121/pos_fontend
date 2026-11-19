import type { SyncEvent } from "./events"

/** ফোনে রাখা সিংক অবস্থা (Db-র বাইরে, ব্যাকআপে যায় না): কার্সর, না-পাঠানো কিউ, অপেক্ষমাণ ইভেন্ট */
export interface SyncState {
  /** সার্ভারের শেষ দেখা seq */
  cursor: number
  /** পাঠানো বাকি; অফলাইনে জমে */
  outbox: SyncEvent[]
  /** নির্ভরতা না মেলায় অপেক্ষায় (বিলের আগে বাতিল ইত্যাদি) */
  deferred: SyncEvent[]
  /** সার্ভার যা বারবার ফেরত দিয়েছে, তাই বাদ দেওয়া ইভেন্টের সংখ্যা */
  dropped: number
  /** পুরনো ডেটা ইভেন্ট করে কিউতে তোলা হয়েছে কি না */
  seeded: boolean
  lastSyncAt: string | null
}

export const emptySyncState = (): SyncState => ({ cursor: 0, outbox: [], deferred: [], dropped: 0, seeded: false, lastSyncAt: null })

export const syncStorageKey = (storeId: string) => `pos.sync.v1.${storeId}`

type Store = Pick<Storage, "getItem" | "setItem">

function defaultStorage(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function parseSyncState(raw: string): SyncState | null {
  try {
    const d = JSON.parse(raw) as Partial<SyncState> | null
    if (typeof d !== "object" || d === null) return null
    if (typeof d.cursor !== "number" || !Array.isArray(d.outbox) || !Array.isArray(d.deferred)) return null
    return {
      cursor: d.cursor,
      outbox: d.outbox,
      deferred: d.deferred,
      dropped: typeof d.dropped === "number" ? d.dropped : 0,
      seeded: d.seeded === true,
      lastSyncAt: typeof d.lastSyncAt === "string" ? d.lastSyncAt : null,
    }
  } catch {
    return null
  }
}

export function loadSyncState(storeId: string, storage: Store | null = defaultStorage()): SyncState {
  try {
    const raw = storage?.getItem(syncStorageKey(storeId))
    return (raw ? parseSyncState(raw) : null) ?? emptySyncState()
  } catch {
    return emptySyncState()
  }
}

export function saveSyncState(storeId: string, state: SyncState, storage: Store | null = defaultStorage()): boolean {
  try {
    storage?.setItem(syncStorageKey(storeId), JSON.stringify(state))
    return storage !== null
  } catch {
    return false
  }
}
