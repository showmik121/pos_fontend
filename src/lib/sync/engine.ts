import type { Db } from "../store/types"
import type { SyncEvent } from "./events"
import { applyEvents, validateEvent } from "./replay"
import { MAX_KEPT_BYTES, MAX_KEPT_EVENTS, type SyncState } from "./state"
import { mergeSkipped, trackDeferred } from "./tracking"

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

/** ok = সফল; offline/auth/server = ব্যর্থতার ধরন; device_limit = দোকানের ২৬টি ডিভাইসের সীমা পূর্ণ; error = অপ্রত্যাশিত ত্রুটি */
export type SyncStatus = "ok" | "offline" | "auth" | "server" | "device_limit" | "error"

/** সার্ভারের বডি সীমা ৬০০ KB; নিরাপদ থাকতে এর নিচে ভাগ করে পাঠাই */
export const PUSH_CHUNK_BYTES = 300_000
export const PUSH_CHUNK_EVENTS = 100
export const PULL_LIMIT = 200
const MAX_PULL_PAGES = 50

const statusOf = (err: unknown): number => {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === "number" ? s : 0
}
const codeOf = (err: unknown): unknown => (err as { code?: unknown } | null)?.code
const messageOf = (err: unknown): string => {
  const m = (err as { message?: unknown } | null)?.message
  return typeof m === "string" ? m.slice(0, 300) : ""
}

/** সিংকের ব্যর্থতাকে ধরনে ভাগ করে (পর্দায় কী বলা হবে তা এর ওপর নির্ভর করে) */
export function classifyError(err: unknown): SyncStatus {
  const code = codeOf(err)
  if (code === "device_unregistered") return "auth"
  if (code === "device_limit") return "device_limit"
  const s = statusOf(err)
  if (s === 401 || s === 403) return "auth"
  if (s === 0) return "offline"
  return "server"
}

const encoder = new TextEncoder()

/** সার্ভার বাইটে মাপে (বাংলা অক্ষর ৩ বাইট), তাই এখানেও বাইটে মাপি; অক্ষর গুনলে বাংলা পেলোডে সীমা ছাড়িয়ে ৪১৩ আসত */
function chunk(events: readonly SyncEvent[]): SyncEvent[][] {
  const out: SyncEvent[][] = []
  let cur: SyncEvent[] = []
  let bytes = 0
  for (const e of events) {
    const size = encoder.encode(JSON.stringify(e)).length
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

/** সার্ভার ইভেন্টটিই নেয়নি (বদ আকার/বিষয়বস্তু)। ডিভাইস নিবন্ধিত না থাকার মতো ত্রুটিতে ইভেন্ট সরানো চলবে না। */
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
  /** `false` মানে ফোনে সেভ হয়নি; তখন সিংক কার্সর এগোয় না (নইলে টানা ইভেন্ট রিলোডে চিরতরে হারাত) */
  setDb(db: Db): unknown
  state(): SyncState
  setState(state: SyncState): void
}

async function pushAll(io: SyncIo, transport: Transport, now: Date): Promise<SyncStatus> {
  const patch = (fn: (s: SyncState) => SyncState) => io.setState(fn(io.state()))
  const sent = (events: readonly SyncEvent[]) => {
    const ids = new Set(events.map((e) => e.id))
    patch((s) => ({ ...s, outbox: s.outbox.filter((e) => !ids.has(e.id)) }))
  }
  // সার্ভার নেয়নি: কিউ থেকে সরিয়ে `rejected`-এ রাখি (মুছি না), যাতে সারি আটকে না থাকে অথচ মালিক দেখতে ও আবার পাঠাতে পারেন।
  // জায়গা (সংখ্যা বা বাইট) না থাকলে ইভেন্ট কিউতেই থাকে: ফোনের কাছে এটিই একমাত্র কপি হতে পারে, তাই কখনো মুছে ফেলি না।
  let blocked = false
  const reject = (event: SyncEvent, err: unknown) => {
    const s = io.state()
    const code = codeOf(err)
    const entry = { event, status: statusOf(err), code: typeof code === "string" ? code : "", message: messageOf(err), rejectedAt: now.toISOString() }
    const bytes = new TextEncoder().encode(JSON.stringify([...s.rejected, entry])).length
    if (s.rejected.length >= MAX_KEPT_EVENTS || bytes > MAX_KEPT_BYTES) {
      blocked = true
      return
    }
    io.setState({ ...s, outbox: s.outbox.filter((e) => e.id !== event.id), rejected: [...s.rejected, entry] })
  }
  for (const part of chunk(io.state().outbox)) {
    try {
      await transport.push(part)
      sent(part)
    } catch (err) {
      if (!isRejected(err) && !isForbidden(err)) return classifyError(err)
      // সার্ভার এই দলটি নেয়নি: একটি একটি করে পাঠিয়ে খারাপটি আলাদা করি
      for (const one of part) {
        try {
          await transport.push([one])
          sent([one])
        } catch (e) {
          if (isForbidden(e)) continue // কিউতে থাকে, বাদ নয়
          if (!isRejected(e)) return classifyError(e)
          reject(one, e)
        }
      }
    }
  }
  // জায়গা না থাকায় কিছু অগ্রাহ্য ইভেন্ট কিউতে রয়ে গেছে: সার্ভারের সাথে ব্যবস্থায় গোলমাল; জানাই, মুছি না
  return blocked ? "server" : "ok"
}

/** একবার সিংক: আগে কিউ পাঠায়, তারপর সার্ভারের নতুন ইভেন্ট টেনে Db-তে বসায়। ব্যর্থ হলে যতটা হয়েছে ততটা রেখে থামে। */
export async function runSync(input: { io: SyncIo; transport: Transport; now: Date }): Promise<SyncStatus> {
  const { io, transport, now } = input
  const pushed = await pushAll(io, transport, now)
  if (pushed !== "ok") return pushed

  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    let got: PulledPage
    try {
      got = await transport.pull(io.state().cursor, PULL_LIMIT)
    } catch (err) {
      return classifyError(err)
    }
    const valid: SyncEvent[] = []
    let malformed = 0
    for (const x of got.events) {
      const e = validateEvent(x)
      if (e) valid.push(e)
      else malformed++
    }
    // পড়া ও লেখার মাঝে await নেই, তাই এর মধ্যে স্থানীয় বদল হারায় না
    const st = io.state()
    // আগে বসাতে না পারা (skipped) ইভেন্টও আবার চেষ্টা হয় (প্রতি সিংকের প্রথম পাতায়): অ্যাপ হালনাগাদের পর নিজে ঠিক হয়ে যায়
    const retry = page === 0 ? st.skipped.map((s) => s.event) : []
    const applied = applyEvents(io.db(), [...st.deferred, ...retry, ...valid])
    // প্রথম পাতার পর আগের skipped আবার চালানো হয় না, কিন্তু তালিকায় থাকে: নতুন ignored-এর সাথে মিলিয়ে রাখি
    const stillSkipped = page === 0 ? applied.ignored : [...st.skipped.map((s) => s.event), ...applied.ignored]
    const skipped = mergeSkipped(st.skipped, stillSkipped, now)
    // ডেটা ফোনে সেভ না হলে কার্সর এগোয় না: নইলে এই ইভেন্টগুলো রিলোডে চিরতরে হারাত (আবার টানলে নিরাপদ, কারণ বসানো idempotent)
    if (io.setDb(applied.db) === false) return "error"
    io.setState({
      ...io.state(),
      cursor: Math.max(io.state().cursor, got.lastSeq),
      deferred: applied.deferred,
      deferredSince: trackDeferred(st.deferredSince, applied.deferred, now),
      skipped: skipped.list,
      malformed: st.malformed + malformed,
      evicted: io.state().evicted + skipped.evicted,
    })
    if (!got.hasMore) break
  }
  io.setState({ ...io.state(), lastSyncAt: now.toISOString() })
  return "ok"
}
