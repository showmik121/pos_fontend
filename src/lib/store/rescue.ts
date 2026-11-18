import { backupFileName, buildBackup } from "./backup"
import { dbStorageKey, isDb } from "./db"
import { localDateIso } from "../domain/dates"

/** অ্যাপ ভেঙে গেলেও যেন দোকানের ডেটা বের করা যায়: Provider, zod বা React-এর ওপর নির্ভর করে না */

const SESSION_KEY = "pos.session.v1"
const DB_PREFIX = "pos.db.v1."
const CORRUPT_SUFFIX = ".corrupt"

type ReadableStorage = Pick<Storage, "getItem" | "key" | "length">

export interface RescueFile {
  fileName: string
  text: string
}

function sessionStoreId(storage: ReadableStorage): string | null {
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const id = (JSON.parse(raw) as { store?: { id?: unknown } | null })?.store?.id
    return typeof id === "string" && id ? id : null
  } catch {
    return null
  }
}

function firstStoreId(storage: ReadableStorage): string | null {
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith(DB_PREFIX) && !k.endsWith(CORRUPT_SUFFIX)) return k.slice(DB_PREFIX.length)
  }
  return null
}

/** ফেরত দেয় নামানোর মতো ফাইল; ডেটা না পেলে বা স্টোরেজ পড়া না গেলে null */
export function rescueBackup(storage: ReadableStorage, now: Date): RescueFile | null {
  try {
    const storeId = sessionStoreId(storage) ?? firstStoreId(storage)
    if (!storeId) return null
    const raw = storage.getItem(dbStorageKey(storeId))
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isDb(parsed)) return { fileName: backupFileName(now), text: buildBackup(parsed, storeId, now) }
    } catch {
      // নষ্ট ডেটা: নিচে কাঁচা অবস্থায় দেওয়া হবে
    }
    return { fileName: `pos-raw-${localDateIso(now)}.json`, text: raw }
  } catch {
    return null
  }
}
