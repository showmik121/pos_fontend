import { describe, expect, it } from "vitest"
import { MAX_KEPT_EVENTS, capKept, emptySyncState, loadSyncState, parseSyncState, saveSyncState, syncStorageKey } from "../src/lib/sync/state"

const KEY = syncStorageKey("s1")
const CORRUPT = `${KEY}.corrupt`

const ev = (n: number) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, kind: "product_upserted", at: "2026-11-20T10:00:00.000Z", payload: { n } })

function storage(initial: Record<string, string> = {}, opts: { failGet?: boolean; failSet?: boolean } = {}) {
  const m = new Map(Object.entries(initial))
  return {
    m,
    api: {
      getItem: (k: string) => {
        if (opts.failGet) throw new Error("SecurityError")
        return m.get(k) ?? null
      },
      setItem: (k: string, v: string) => {
        if (opts.failSet) throw new Error("QuotaExceededError")
        m.set(k, v)
      },
    },
  }
}

describe("নষ্ট সিংক-অবস্থা চুপচাপ ফাঁকা হয়ে যায় না (#4)", () => {
  it("JSON ভাঙা হলে কাঁচা লেখা .corrupt কপিতে থাকে, damaged=true, আর seeded=false (পরের লোডে সব আবার কিউতে ওঠে)", () => {
    const s = storage({ [KEY]: '{"cursor":5,"outbox":[' })
    const st = loadSyncState("s1", s.api)
    expect(st.damaged).toBe(true)
    expect(st.seeded).toBe(false)
    expect(st.outbox).toEqual([])
    expect(s.m.get(CORRUPT)).toBe('{"cursor":5,"outbox":[')
  })

  it("কাঠামো ভুল (cursor নেই) হলেও কপি থাকে", () => {
    const s = storage({ [KEY]: JSON.stringify({ outbox: [], deferred: [] }) })
    expect(loadSyncState("s1", s.api).damaged).toBe(true)
    expect(s.m.has(CORRUPT)).toBe(true)
  })

  it("আগের .corrupt কপি নতুন নষ্ট লেখা দিয়ে ঘষা হয় না", () => {
    const s = storage({ [KEY]: "broken-2", [CORRUPT]: "original" })
    loadSyncState("s1", s.api)
    expect(s.m.get(CORRUPT)).toBe("original")
  })

  it("পড়তে গিয়ে ছুঁড়লে ফাঁকা অবস্থা ও damaged=true (কপি রাখার উপায় নেই, কিন্তু আর চুপ নয়)", () => {
    const s = storage({}, { failGet: true })
    const st = loadSyncState("s1", s.api)
    expect(st.damaged).toBe(true)
    expect(st.seeded).toBe(false)
  })

  it("ভালো অবস্থায় কপি বানায় না, damaged=false", () => {
    const good = { ...emptySyncState(), seeded: true, cursor: 7, outbox: [ev(1)] }
    const s = storage({ [KEY]: JSON.stringify(good) })
    const st = loadSyncState("s1", s.api)
    expect(st.damaged).toBe(false)
    expect(st.outbox).toEqual([ev(1)])
    expect(s.m.has(CORRUPT)).toBe(false)
  })

  it("কিউ বা অপেক্ষমাণের নষ্ট উপাদান বাদ যায় ও malformed-এ গোনা হয়; ভালোগুলো থাকে; কাঁচা কপিও থাকে", () => {
    const raw = JSON.stringify({ ...emptySyncState(), seeded: true, outbox: [ev(1), { id: "x" }, null, "str"], deferred: [ev(2), 42] })
    const s = storage({ [KEY]: raw })
    const st = loadSyncState("s1", s.api)
    expect(st.outbox).toEqual([ev(1)])
    expect(st.deferred).toEqual([ev(2)])
    expect(st.malformed).toBe(4)
    expect(s.m.get(CORRUPT)).toBe(raw)
    expect(st.damaged).toBe(false) // অবস্থা পড়া গেছে; শুধু কিছু উপাদান নষ্ট ছিল
  })

  it("পুরনো ফরম্যাট (নতুন ফিল্ড নেই) ঠিকঠাক পড়ে, ডিফল্ট বসে", () => {
    const old = { cursor: 3, outbox: [], deferred: [], dropped: 2, seeded: true, lastSyncAt: null }
    const st = parseSyncState(JSON.stringify(old))
    expect(st).not.toBeNull()
    expect(st).toMatchObject({ cursor: 3, dropped: 2, rejected: [], skipped: [], malformed: 0, deferredSince: {}, evicted: 0, damaged: false })
  })

  it("saveSyncState ব্যর্থ হলে false", () => {
    expect(saveSyncState("s1", emptySyncState(), storage({}, { failSet: true }).api)).toBe(false)
    expect(saveSyncState("s1", emptySyncState(), storage().api)).toBe(true)
  })
})

describe("capKept: সীমা পেরোলে পুরনোটা যায়, আর গোনা হয় (চুপচাপ নয়)", () => {
  it("সীমার মধ্যে কিছু বাদ যায় না", () => {
    expect(capKept([1, 2, 3], 5)).toEqual({ list: [1, 2, 3], evicted: 0 })
  })
  it("সীমা পেরোলে সবচেয়ে পুরনো (শুরুর) গুলো বাদ", () => {
    expect(capKept([1, 2, 3, 4, 5], 3)).toEqual({ list: [3, 4, 5], evicted: 2 })
  })
  it("ডিফল্ট সীমা ৫০০", () => {
    expect(MAX_KEPT_EVENTS).toBe(500)
  })
})
