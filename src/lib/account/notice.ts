import type { SyncStatus } from "../sync/engine"
import type { StoreStatus } from "../api/schemas"

export interface TenantNotice {
  kind: "suspended" | "read_only"
  /** অপারেটরের লেখা বার্তা (বাংলা); না থাকলে অ্যাপের নিজের সাধারণ লেখা দেখানো হয় */
  message: string | null
}

interface Input {
  /** শেষ `/v1/me` বা লগইনে পাওয়া অবস্থা (পুরনো সার্ভারে নেই) */
  storeStatus: StoreStatus | null | undefined
  /** সর্বশেষ সিংকের ফল (এখনো না হলে null) */
  sync: SyncStatus | null
  message: string | null | undefined
}

/**
 * মালিককে কী জানানো হবে। সর্বশেষ সিংক সবচেয়ে তাজা প্রমাণ: ব্যর্থ হলে সেটিই, সফল হলে (অপারেটর চালু করেছেন) কিছুই নয়;
 * সিংক না হলে (অফলাইন/শুরুর মুহূর্ত) শেষ জানা অবস্থা। `deleted`/`pending_deletion` সাসপেন্ডের মতোই দেখায়।
 */
export function tenantNotice({ storeStatus, sync, message }: Input): TenantNotice | null {
  const msg = message ?? null
  if (sync === "suspended") return { kind: "suspended", message: msg }
  if (sync === "read_only") return { kind: "read_only", message: msg }
  if (sync === "ok") return null
  if (storeStatus === "suspended" || storeStatus === "pending_deletion" || storeStatus === "deleted") return { kind: "suspended", message: msg }
  if (storeStatus === "read_only") return { kind: "read_only", message: msg }
  return null
}
