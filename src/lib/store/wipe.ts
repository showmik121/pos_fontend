import { reminderStorageKey } from "./backup-reminder"
import { dbStorageKey } from "./db"
import { deviceStorageKey } from "./device"
import { syncCorruptKeys, syncStorageKey } from "../sync/state"

/**
 * এই ফোন থেকে এক দোকানের স্থানীয় ডেটা মোছে: পণ্য-বিল-বাকি, নষ্ট-ব্যাকআপ কপি, ডিভাইস কোড ও ব্যাকআপ-স্মরণ।
 * ডিভাইস কোডও যায়, নইলে ডেটা ফাঁকা হয়ে বিল নম্বর আবার ১০০১ থেকে শুরু হয়ে একই উপসর্গে পুরনো বিলের নম্বর দ্বিতীয়বার আসত।
 * অন্য দোকানের ডেটা ছোঁয়া হয় না। সফল হলে true।
 */
export function wipeStoreData(storage: Pick<Storage, "removeItem"> | undefined, storeId: string): boolean {
  if (!storage) return false
  try {
    storage.removeItem(dbStorageKey(storeId))
    storage.removeItem(`${dbStorageKey(storeId)}.corrupt`)
    storage.removeItem(deviceStorageKey(storeId))
    storage.removeItem(reminderStorageKey(storeId))
    storage.removeItem(syncStorageKey(storeId))
    // নষ্ট সিংক-অবস্থার কাঁচা কপি: তাতে পুরনো কিউ (ক্রয়মূল্য, গ্রাহকের তথ্যসহ) থাকে; ওয়াইপের পর ফোনে থাকা চলবে না
    for (const k of syncCorruptKeys(storeId)) storage.removeItem(k)
    return true
  } catch {
    return false
  }
}
