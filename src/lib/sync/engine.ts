import type { Db } from "../store/types"
import type { SyncEvent } from "./events"
import { applyEvents, validateEvent } from "./replay"
import type { SyncState } from "./state"

export interface PulledPage {
  events: unknown[]
  lastSeq: number
  hasMore: boolean
}

/** নেটওয়ার্কের পাতলা স্তর; ব্যর্থ হলে `status` (0 = নেটওয়ার্ক) সহ ত্রুটি ছোঁড়ে (ApiError মানে) */
export interface Transport {
  push(events: SyncEvent[]): Promise<void>
  pull(after: number, limit: number): Promise<PulledPage>
}

export type SyncStatus = "ok" | "offline" | "auth" | "server"

/** সার্ভারের বডি সীমা ৬০০ KB; নিরাপদ থাকতে এর নিচে ভাগ করে পাঠাই */
export const PUSH_CHUNK_BYTES = 300_000
export const PUSH_CHUNK_EVENTS = 100
export const PULL_LIMIT = 200
const MAX_PULL_PAGES = 50

const statusOf = (err: unknown): number => {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === "number" ? s : 0
}

function classify(err: unknown): SyncStatus {
  if (codeOf(err) === "device_unregistered") return "auth"
  const s = statusOf(err)
  if (s === 401 || s === 403) return "auth"
  if (s === 0) return "offline"
  return "server"
}

function chunk(events: readonly SyncEvent[]): SyncEvent[][] {
  const out: SyncEvent[][] = []
  let cur: SyncEvent[] = []
  let bytes = 0
  for (const e of events) {
    const size = JSON.stringify(e).length
    if (cur.length > 0 && (cur.length >= PUSH_CHUNK_EVENTS || bytes + size > PUSH_CHUNK_BYTES)) {
      out.push(cur)
      cur = []
      bytes = 0
    }
    cur.push(e)
    bytes += size
  }
  if (cur.length) out.push(cur)
  return out
}

const codeOf = (err: unknown): unknown => (err as { code?: unknown } | null)?.code
/** সার্ভার ইভেন্টটিই নেয়নি (বদ আকার/বিষয়বস্তু)। ডিভাইস নিবন্ধিত না থাকার মতো ত্রুটিতে ইভেন্ট বাদ দেওয়া চলবে না। */
const isRejected = (err: unknown) => (statusOf(err) === 400 || statusOf(err) === 413) && codeOf(err) !== "device_unregistered"
/**
 * এই ব্যবহারকারীর এই ধরনের ইভেন্ট পাঠানোর অনুমতি নেই (যেমন কর্মচারীর সেশনে মালিকের কিউ-করা বাতিল/ব্যাচ সরানো)।
 * ফোনের কিউ দোকান-ভিত্তিক, ব্যবহারকারী-ভিত্তিক নয়; তাই এটি বাদ দেওয়া চলবে না (মালিক পরে সিংক করলে যাবে),
 * শুধু আটকে রেখে বাকিগুলো পাঠাই, যাতে এই একটি ইভেন্ট সিংক আটকে না দেয়।
 */
const isForbidden = (err: unknown) => statusOf(err) === 403 && codeOf(err) === "forbidden"

/**
 * Db ও অবস্থা পড়া/লেখার পথ। রান চলার মাঝে ব্যবহারকারী নতুন বদল করতে পারে, তাই
 * প্রতিবার সবচেয়ে নতুন মান পড়ে (await-এর আগের কপি দিয়ে ঘষা হয় না)।
 */
export interface SyncIo {
  db(): Db
  setDb(db: Db): void
  state(): SyncState
  setState(state: SyncState): void
}

async function pushAll(io: SyncIo, transport: Transport): Promise<SyncStatus> {
  const patch = (fn: (s: SyncState) => SyncState) => io.setState(fn(io.state()))
  const drop = (sent: readonly SyncEvent[], rejected = 0) => {
    const ids = new Set(sent.map((e) => e.id))
    patch((s) => ({ ...s, outbox: s.outbox.filter((e) => !ids.has(e.id)), dropped: s.dropped + rejected }))
  }
  for (const part of chunk(io.state().outbox)) {
    try {
      await transport.push(part)
      drop(part)
    } catch (err) {
      if (!isRejected(err) && !isForbidden(err)) return classify(err)
      // সার্ভার এই দলটি নেয়নি: একটি একটি করে পাঠিয়ে খারাপটি আলাদা করি, যাতে সারি আটকে না থাকে
      for (const one of part) {
        try {
          await transport.push([one])
          drop([one])
        } catch (e) {
          if (isForbidden(e)) continue // কিউতে থাকে, বাদ নয়
          if (!isRejected(e)) return classify(e)
          drop([one], 1)
        }
      }
    }
  }
  return "ok"
}

/** একবার সিংক: আগে কিউ পাঠায়, তারপর সার্ভারের নতুন ইভেন্ট টেনে Db-তে বসায়। ব্যর্থ হলে যতটা হয়েছে ততটা রেখে থামে। */
export async function runSync(input: { io: SyncIo; transport: Transport; now: Date }): Promise<SyncStatus> {
  const { io, transport } = input
  const pushed = await pushAll(io, transport)
  if (pushed !== "ok") return pushed

  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    let got: PulledPage
    try {
      got = await transport.pull(io.state().cursor, PULL_LIMIT)
    } catch (err) {
      return classify(err)
    }
    const valid = got.events.flatMap((x) => {
      const e = validateEvent(x)
      return e ? [e] : []
    })
    // পড়া ও লেখার মাঝে await নেই, তাই এর মধ্যে স্থানীয় বদল হারায় না
    const applied = applyEvents(io.db(), [...io.state().deferred, ...valid])
    io.setDb(applied.db)
    io.setState({ ...io.state(), cursor: Math.max(io.state().cursor, got.lastSeq), deferred: applied.deferred })
    if (!got.hasMore) break
  }
  io.setState({ ...io.state(), lastSyncAt: input.now.toISOString() })
  return "ok"
}
