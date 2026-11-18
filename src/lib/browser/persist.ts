type StorageManagerLike = Pick<StorageManager, "persisted" | "persist">

/**
 * ব্রাউজারকে বলে "এই ডেটা স্থায়ী রাখো", যাতে জায়গা কমলে বা অনেক দিন না খুললে নিজে থেকে না মোছে।
 * ফেরত: true = স্থায়ী, false = পাওয়া যায়নি/ব্যর্থ, null = ব্রাউজার এই সুবিধা দেয় না
 */
export async function requestPersistentStorage(
  sm: StorageManagerLike | undefined = typeof navigator === "undefined" ? undefined : navigator.storage,
): Promise<boolean | null> {
  if (!sm || typeof sm.persist !== "function" || typeof sm.persisted !== "function") return null
  try {
    if (await sm.persisted()) return true
    return await sm.persist()
  } catch {
    return false
  }
}
