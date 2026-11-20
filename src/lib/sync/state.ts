import type { SyncEvent } from "./events"
import { validateEvent } from "./replay"

/** সার্ভার যে ইভেন্ট নেয়নি (৪০০/৪১৩)। মুছে না ফেলে রাখা হয়: মালিক দেখতে ও আবার পাঠাতে পারেন */
export interface RejectedEvent {
  event: SyncEvent
  status: number
  code: string
  message: string
  rejectedAt: string
}

/** সার্ভার থেকে পাওয়া কিন্তু এই ফোনে বসানো যায়নি (অচেনা ধরন বা নষ্ট পেলোড)। প্রতি সিংকে আবার চেষ্টা হয়, তাই অ্যাপ হালনাগাদের পর নিজে বসে যায় */
export interface SkippedEvent {
  event: SyncEvent
  reason: "unknown_kind" | "bad_payload"
  since: string
}

/** রাখা ইভেন্টের তালিকার সীমা (স্থানীয় সেভ-জায়গা সীমিত); পেরোলে পুরনোটা যায় এবং `evicted`-এ গোনা হয় */
export const MAX_KEPT_EVENTS = 500

/** ফোনে রাখা সিংক অবস্থা (Db-র বাইরে, ব্যাকআপে যায় না): কার্সর, না-পাঠানো কিউ, অপেক্ষমাণ ইভেন্ট */
export interface SyncState {
  /** সার্ভারের শেষ দেখা seq */
  cursor: number
  /** পাঠানো বাকি; অফলাইনে জমে */
  outbox: SyncEvent[]
  /** নির্ভরতা না মেলায় অপেক্ষায় (বিলের আগে বাতিল ইত্যাদি) */
  deferred: SyncEvent[]
  /** আগের সংস্করণে সার্ভার-অগ্রাহ্য বলে বাদ দেওয়া ইভেন্টের সংখ্যা (এখন বাদ না দিয়ে `rejected`-এ রাখা হয়) */
  dropped: number
  /** সার্ভার নেয়নি, তাই রাখা আছে */
  rejected: RejectedEvent[]
  /** পেয়েছি কিন্তু বসাতে পারিনি */
  skipped: SkippedEvent[]
  /** কাঠামোই নষ্ট ইভেন্টের সংখ্যা (সার্ভার থেকে আসা বা ফোনে নষ্ট হওয়া); কেউ বসাতে পারবে না */
  malformed: number
  /** অপেক্ষমাণ ইভেন্ট প্রথম কখন অপেক্ষায় গেছে (id -> ISO); আটকে থাকা ধরতে */
  deferredSince: Record<string, string>
  /** সীমার কারণে তালিকা থেকে বাদ পড়া ইভেন্টের সংখ্যা */
  evicted: number
  /** সংরক্ষিত অবস্থা পড়া যায়নি/নষ্ট ছিল; কাঁচা কপি `.corrupt` কী-তে */
  damaged: boolean
  /** পুরনো ডেটা ইভেন্ট করে কিউতে তোলা হয়েছে কি না */
  seeded: boolean
  lastSyncAt: string | null
}

export const emptySyncState = (): SyncState => ({
  cursor: 0,
  outbox: [],
  deferred: [],
  dropped: 0,
  rejected: [],
  skipped: [],
  malformed: 0,
  deferredSince: {},
  evicted: 0,
  damaged: false,
  seeded: false,
  lastSyncAt: null,
})

export const syncStorageKey = (storeId: string) => `pos.sync.v1.${storeId}`

type Store = Pick<Storage, "getItem" | "setItem">

function defaultStorage(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)

/** তালিকা থেকে সীমার বেশি অংশ (পুরনোগুলো, অর্থাৎ শুরুর দিক) বাদ দেয় ও কত গেল জানায় */
export function capKept<T>(list: readonly T[], max: number = MAX_KEPT_EVENTS): { list: T[]; evicted: number } {
  const evicted = Math.max(0, list.length - max)
  return { list: evicted > 0 ? list.slice(evicted) : [...list], evicted }
}

/** তালিকার বৈধ উপাদান রাখে; কয়টি বাদ গেল জানায় */
function keepValid<T>(raw: unknown[], ok: (x: unknown) => T | null): { kept: T[]; bad: number } {
  const kept: T[] = []
  let bad = 0
  for (const x of raw) {
    const v = ok(x)
    if (v === null) bad++
    else kept.push(v)
  }
  return { kept, bad }
}

const asRejected = (x: unknown): RejectedEvent | null => {
  if (!isObj(x)) return null
  const event = validateEvent(x.event)
  if (!event || !isNum(x.status) || typeof x.code !== "string" || typeof x.message !== "string" || typeof x.rejectedAt !== "string") return null
  return { event, status: x.status, code: x.code, message: x.message, rejectedAt: x.rejectedAt }
}

const asSkipped = (x: unknown): SkippedEvent | null => {
  if (!isObj(x)) return null
  const event = validateEvent(x.event)
  if ((x.reason !== "unknown_kind" && x.reason !== "bad_payload") || !event || typeof x.since !== "string") return null
  return { event, reason: x.reason, since: x.since }
}

interface Parsed {
  state: SyncState
  /** নষ্ট হওয়ায় বাদ পড়া উপাদানের সংখ্যা (এই পড়ায়) */
  droppedNow: number
}

function parseDetailed(raw: string): Parsed | null {
  let d: unknown
  try {
    d = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(d) || !isNum(d.cursor) || !Array.isArray(d.outbox) || !Array.isArray(d.deferred)) return null
  const outbox = keepValid(d.outbox, validateEvent)
  const deferred = keepValid(d.deferred, validateEvent)
  const rejected = keepValid(Array.isArray(d.rejected) ? d.rejected : [], asRejected)
  const skipped = keepValid(Array.isArray(d.skipped) ? d.skipped : [], asSkipped)
  const since = isObj(d.deferredSince) ? Object.fromEntries(Object.entries(d.deferredSince).filter((kv): kv is [string, string] => typeof kv[1] === "string")) : {}
  const droppedNow = outbox.bad + deferred.bad + rejected.bad + skipped.bad
  return {
    droppedNow,
    state: {
      cursor: d.cursor,
      outbox: outbox.kept,
      deferred: deferred.kept,
      dropped: isNum(d.dropped) ? d.dropped : 0,
      rejected: rejected.kept,
      skipped: skipped.kept,
      malformed: (isNum(d.malformed) ? d.malformed : 0) + droppedNow,
      deferredSince: since,
      evicted: isNum(d.evicted) ? d.evicted : 0,
      damaged: d.damaged === true,
      seeded: d.seeded === true,
      lastSyncAt: typeof d.lastSyncAt === "string" ? d.lastSyncAt : null,
    },
  }
}

export function parseSyncState(raw: string): SyncState | null {
  return parseDetailed(raw)?.state ?? null
}

/** নষ্ট বা অচেনা কাঁচা লেখা আলাদা কপিতে রাখে। আগের কপি ঘষে না: সেটিই সবচেয়ে পুরনো, অর্থাৎ আসলের কাছাকাছি। */
function keepCorruptCopy(storage: Store, storeId: string, raw: string): void {
  const k = `${syncStorageKey(storeId)}.corrupt`
  try {
    if (storage.getItem(k) === null) storage.setItem(k, raw)
  } catch {
    // জায়গা নেই: কিছু করার নেই; মূল কী ঘষা না হওয়া পর্যন্ত কাঁচা লেখা সেখানেই থাকে
  }
}

/**
 * সংরক্ষিত অবস্থা পড়ে। নষ্ট হলে ফাঁকা অবস্থা দেয় ঠিকই, কিন্তু চুপচাপ নয়:
 * কাঁচা লেখা `.corrupt` কপিতে রাখে, `damaged: true` বসায়, আর `seeded: false` রাখে
 * যাতে পরের লোডে ফোনের ডেটা স্থির-id ইভেন্টে আবার কিউতে ওঠে (সার্ভারে দ্বিগুণ হয় না)।
 */
export function loadSyncState(storeId: string, storage: Store | null = defaultStorage()): SyncState {
  if (!storage) return emptySyncState()
  let raw: string | null
  try {
    raw = storage.getItem(syncStorageKey(storeId))
  } catch {
    return { ...emptySyncState(), damaged: true }
  }
  if (!raw) return emptySyncState()
  const parsed = parseDetailed(raw)
  if (!parsed) {
    keepCorruptCopy(storage, storeId, raw)
    return { ...emptySyncState(), damaged: true }
  }
  if (parsed.droppedNow > 0) keepCorruptCopy(storage, storeId, raw)
  return parsed.state
}

export function saveSyncState(storeId: string, state: SyncState, storage: Store | null = defaultStorage()): boolean {
  try {
    storage?.setItem(syncStorageKey(storeId), JSON.stringify(state))
    return storage !== null
  } catch {
    return false
  }
}
