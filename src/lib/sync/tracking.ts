import type { SyncEvent } from "./events"
import { isKnownKind } from "./replay"
import { capKeptBytes, type SkippedEvent, type SyncState } from "./state"

/** এর বেশি সময় অপেক্ষায় থাকা ইভেন্ট "আটকে গেছে" ধরা হয় (অন্য ফোনের তথ্য আসেনি, বা চিরকাল আসবে না) */
export const STUCK_DEFERRED_MS = 24 * 3_600_000

/** অপেক্ষমাণ ইভেন্ট প্রথম কখন অপেক্ষায় গেছে তার হিসাব: নতুনেরা এখনকার সময় পায়, আগেরগুলোর সময় বদলায় না, ছেড়ে যাওয়াগুলো মুছে যায় */
export function trackDeferred(prev: Readonly<Record<string, string>>, deferred: readonly SyncEvent[], now: Date): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of deferred) out[e.id] = prev[e.id] ?? now.toISOString()
  return out
}

/** `thresholdMs`-এর বেশি সময় ধরে অপেক্ষায় থাকা ইভেন্ট */
export function stuckDeferred(state: Pick<SyncState, "deferred" | "deferredSince">, now: Date, thresholdMs: number = STUCK_DEFERRED_MS): SyncEvent[] {
  return state.deferred.filter((e) => {
    const since = Date.parse(state.deferredSince[e.id] ?? "")
    return Number.isFinite(since) && now.getTime() - since > thresholdMs
  })
}

/**
 * এই দফায় বসাতে না পারা ইভেন্টগুলো `skipped` তালিকা বানায়। একই id দুবার থাকে না (Map দিয়ে), আগে থেকে থাকলে `since` বদলায় না;
 * কারণ: ধরনটাই অচেনা (অ্যাপ পুরনো) নাকি ধরন চেনা কিন্তু পেলোড নষ্ট। সংখ্যা ও বাইট দুই সীমাই মানে।
 */
export function mergeSkipped(prev: readonly SkippedEvent[], ignored: readonly SyncEvent[], now: Date): { list: SkippedEvent[]; evicted: number } {
  const before = new Map(prev.map((s) => [s.event.id, s]))
  const next = new Map<string, SkippedEvent>()
  for (const event of ignored) {
    if (next.has(event.id)) continue
    next.set(event.id, before.get(event.id) ?? { event, reason: isKnownKind(event.kind) ? "bad_payload" : "unknown_kind", since: now.toISOString() })
  }
  return capKeptBytes([...next.values()])
}

/** সার্ভার যে ইভেন্ট নেয়নি সেগুলো আবার কিউয়ে তোলে (আগের কিউয়ের পরে; একই id দুবার নয়) */
export function retryRejected(state: SyncState): SyncState {
  const queued = new Set(state.outbox.map((e) => e.id))
  const again = state.rejected.map((r) => r.event).filter((e) => !queued.has(e.id))
  return { ...state, outbox: [...state.outbox, ...again], rejected: [] }
}
