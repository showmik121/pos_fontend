import { describe, expect, it, vi } from "vitest"
import { emptyDb } from "../src/lib/store/db"
import type { Db } from "../src/lib/store/types"
import { runSyncCycle, type CycleDeps } from "../src/lib/sync/cycle"
import { runSync, type Transport } from "../src/lib/sync/engine"
import type { SyncEvent } from "../src/lib/sync/events"
import { MAX_KEPT_BYTES, MAX_KEPT_EVENTS, capKeptBytes, clearSyncCorruptCopy, emptySyncState, loadSyncState, syncStorageKey, type SyncState } from "../src/lib/sync/state"
import { mergeSkipped } from "../src/lib/sync/tracking"
import { acquireWriter, type LockManagerLike } from "../src/lib/store/tab-lock"

const ev = (n: number, pad = 0): SyncEvent => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, kind: "future_thing", at: "2026-11-20T09:00:00.000Z", payload: { p: "x".repeat(pad) } })
const NOW = new Date("2026-11-20T10:00:00.000Z")
const apiErr = (status: number, code = "") => Object.assign(new Error("x"), { status, code })

describe("তালিকার সীমা বাইটেও (কোটা ভরা ঠেকাতে)", () => {
  it("মোট বাইট সীমা ছাড়ালে পুরনোগুলো যায় ও গোনা হয়; সবচেয়ে নতুনটি থাকে", () => {
    const big = Array.from({ length: 10 }, (_, i) => ({ event: ev(i, 40_000) }))
    const out = capKeptBytes(big, 500, MAX_KEPT_BYTES)
    expect(new TextEncoder().encode(JSON.stringify(out.list)).length).toBeLessThanOrEqual(MAX_KEPT_BYTES)
    expect(out.evicted).toBe(10 - out.list.length)
    expect(out.evicted).toBeGreaterThan(0)
    expect(out.list.at(-1)).toBe(big.at(-1))
  })

  it("ছোট তালিকায় কিছু বাদ যায় না", () => {
    const small = [{ event: ev(1) }, { event: ev(2) }]
    expect(capKeptBytes(small, 500, MAX_KEPT_BYTES)).toEqual({ list: small, evicted: 0 })
  })

  it("সংরক্ষিত অবস্থা লোডের সময়ও সীমা প্রযোজ্য", () => {
    const skipped = Array.from({ length: 10 }, (_, i) => ({ event: ev(i, 30_000), reason: "unknown_kind", since: NOW.toISOString() }))
    const raw = JSON.stringify({ ...emptySyncState(), seeded: true, skipped })
    const st = loadSyncState("s1", { getItem: () => raw, setItem: () => {} })
    expect(new TextEncoder().encode(JSON.stringify(st.skipped)).length).toBeLessThanOrEqual(MAX_KEPT_BYTES)
    expect(st.evicted).toBeGreaterThan(0)
  })
})

describe("mergeSkipped: একই id দুবার থাকে না", () => {
  it("একই ইভেন্ট দুবার এলেও একটিই, আগের since বজায়", () => {
    const e = ev(1)
    const prev = [{ event: e, reason: "unknown_kind" as const, since: "2026-11-19T00:00:00.000Z" }]
    const out = mergeSkipped(prev, [e, e], NOW)
    expect(out.list).toHaveLength(1)
    expect(out.list[0]?.since).toBe("2026-11-19T00:00:00.000Z")
  })
})

describe("সংরক্ষিত অবস্থায় বিপজ্জনক কী বাদ", () => {
  it("deferredSince-এ __proto__/constructor/prototype ঢোকে না", () => {
    const raw = `{"cursor":1,"outbox":[],"deferred":[],"deferredSince":{"__proto__":"x","constructor":"y","prototype":"z","ok":"2026-11-20T00:00:00.000Z"}}`
    const st = loadSyncState("s1", { getItem: () => raw, setItem: () => {} })
    expect(Object.keys(st.deferredSince)).toEqual(["ok"])
  })
})

describe("নষ্ট অবস্থার কাঁচা কপি", () => {
  it("আগের কপি থাকলে নতুনটি পরের জায়গায় যায় (কিছু ঘষা হয় না)", () => {
    const k = syncStorageKey("s1")
    const m = new Map([[k, "broken-2"], [`${k}.corrupt`, "first"]])
    loadSyncState("s1", { getItem: (x) => m.get(x) ?? null, setItem: (x, v) => void m.set(x, v) })
    expect(m.get(`${k}.corrupt`)).toBe("first")
    expect(m.get(`${k}.corrupt.2`)).toBe("broken-2")
  })

  it("clearSyncCorruptCopy সব কপি মোছে", () => {
    const k = syncStorageKey("s1")
    const m = new Map([[`${k}.corrupt`, "a"], [`${k}.corrupt.2`, "b"], [`${k}.corrupt.3`, "c"], ["other", "keep"]])
    clearSyncCorruptCopy("s1", { removeItem: (x: string) => void m.delete(x) })
    expect([...m.keys()]).toEqual(["other"])
  })
})

describe("সিংক-চক্র: কোড সেভে ছুঁড়লে সেটি 'অফলাইন' নয়", () => {
  it("saveDeviceCode ছুঁড়লে অবস্থা error", async () => {
    const noted: string[] = []
    const d: CycleDeps = {
      device: () => ({ id: "d", code: null }),
      saveDeviceCode: () => {
        throw new Error("QuotaExceeded")
      },
      registerDevice: async () => "A",
      pushEvents: async () => {},
      pullEvents: async (after) => ({ events: [], lastSeq: after, hasMore: false }),
      syncNow: vi.fn(async () => "ok" as const),
      note: (s) => void noted.push(s),
      report: () => {},
    }
    expect(await runSyncCycle(d)).toBe("error")
    expect(noted).toEqual(["error"])
  })
})

function harness(state: Partial<SyncState> = {}, setDb: (d: Db) => boolean | void = () => {}) {
  const h = { db: emptyDb(), state: { ...emptySyncState(), seeded: true, ...state } as SyncState }
  return { h, io: { db: () => h.db, setDb, state: () => h.state, setState: (s: SyncState) => (h.state = s) } }
}

describe("ডেটা সেভ না হলে কার্সর এগোয় না (নইলে টানা ইভেন্ট চিরতরে হারাত)", () => {
  it("setDb false দিলে অবস্থা error, কার্সর ও অপেক্ষমাণ বদলায় না", async () => {
    const e = ev(1)
    const { h, io } = harness({ cursor: 3 }, () => false)
    const transport: Transport = { push: async () => {}, pull: async () => ({ events: [e], lastSeq: 9, hasMore: false }) }
    expect(await runSync({ io, transport, now: NOW })).toBe("error")
    expect(h.state.cursor).toBe(3)
    expect(h.state.skipped).toEqual([])
  })
})

describe("সার্ভার-অগ্রাহ্য ইভেন্ট কখনো মুছে যায় না, সীমা পূর্ণ হলে কিউতে থাকে", () => {
  it("সীমার বেশিগুলো কিউতেই থাকে, অবস্থা server, evicted বাড়ে না", async () => {
    const events = Array.from({ length: MAX_KEPT_EVENTS + 2 }, (_, i) => ev(i + 1))
    const { h, io } = harness({ outbox: events })
    const transport: Transport = {
      async push() {
        throw apiErr(400, "invalid_input")
      },
      pull: async (after) => ({ events: [], lastSeq: after, hasMore: false }),
    }
    expect(await runSync({ io, transport, now: NOW })).toBe("server")
    expect(h.state.rejected).toHaveLength(MAX_KEPT_EVENTS)
    expect(h.state.outbox.map((e) => e.id)).toEqual(events.slice(MAX_KEPT_EVENTS).map((e) => e.id))
    expect(h.state.evicted).toBe(0)
  })
})

/** release-এর পর লক এক ধাপ পরে ছাড়ে (আসল ব্রাউজারের মতো); ifAvailable মডেল করা */
function slowReleaseLocks(): LockManagerLike {
  const held = new Map<string, number>()
  let seq = 0
  return {
    request(name, options, callback) {
      return new Promise((resolve) => {
        const id = ++seq
        if (held.get(name) && options.ifAvailable) {
          void Promise.resolve(callback(null)).then(() => resolve(undefined))
          return
        }
        held.set(name, id)
        void Promise.resolve(callback({ name })).then(async () => {
          await Promise.resolve()
          await Promise.resolve()
          if (held.get(name) === id) held.delete(name)
          resolve(undefined)
        })
      })
    },
  }
}

describe("acquireWriter: নিজের আগের লক ছাড়ার পরপরই আবার নিলে reader হয় না (StrictMode/লগআউট-লগইন)", () => {
  it("release() ডেকে সঙ্গে সঙ্গে আবার acquire করলে writer", async () => {
    const locks = slowReleaseLocks()
    const a = await acquireWriter({ storeId: "race", locks, onLost: () => {} })
    if (a.status !== "writer") throw new Error("expected writer")
    a.release()
    expect((await acquireWriter({ storeId: "race", locks, onLost: () => {} })).status).toBe("writer")
  })

  it("StrictMode: পরপর দুটি acquire, প্রথমটির ফল আসামাত্র effect-cleanup ছাড়ে — দ্বিতীয়টি writer", async () => {
    const locks = slowReleaseLocks()
    const first = acquireWriter({ storeId: "strict", locks, onLost: () => {} })
    void first.then((r) => {
      if (r.status === "writer") r.release()
    })
    const second = await acquireWriter({ storeId: "strict", locks, onLost: () => {} })
    expect(second.status).toBe("writer")
  })

  it("অন্য ট্যাব ধরে থাকলে (নিজে ছাড়েনি) তখনও reader", async () => {
    const locks = slowReleaseLocks()
    await acquireWriter({ storeId: "other", locks, onLost: () => {} })
    expect((await acquireWriter({ storeId: "other", locks, onLost: () => {} })).status).toBe("reader")
  })

  it("AbortError ছাড়া অন্য ব্যর্থতায় ট্যাব reader নয়, unsupported (বিক্রি আটকায় না)", async () => {
    const locks: LockManagerLike = { request: () => Promise.reject(Object.assign(new Error("denied"), { name: "SecurityError" })) }
    const lost = vi.fn()
    expect((await acquireWriter({ storeId: "x", locks, onLost: lost })).status).toBe("unsupported")
    expect(lost).not.toHaveBeenCalled()
  })
})
