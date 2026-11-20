import { describe, expect, it } from "vitest"
import { createProduct } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import type { Db } from "../src/lib/store/types"
import { PUSH_CHUNK_BYTES, classifyError, runSync, type PulledPage, type Transport } from "../src/lib/sync/engine"
import { productEvent, type SyncEvent } from "../src/lib/sync/events"
import { uuidFrom } from "../src/lib/sync/ids"
import { stuckDeferred, retryRejected, trackDeferred } from "../src/lib/sync/tracking"
import { MAX_KEPT_EVENTS, emptySyncState, type SyncState } from "../src/lib/sync/state"

const NOW = new Date("2026-11-20T10:00:00.000Z")
let n = 0
const uid = () => uuidFrom(`r${++n}`)
const mk = (kind: string, payload: Record<string, unknown> = {}, id = uid()): SyncEvent => ({ id, kind, at: "2026-11-20T09:00:00.000Z", payload })
const apiErr = (status: number, code: string, message = "msg") => Object.assign(new Error(message), { status, code })

function harness(state: Partial<SyncState> = {}, db: Db = emptyDb()) {
  const h = { db, state: { ...emptySyncState(), seeded: true, ...state } as SyncState }
  return {
    h,
    io: { db: () => h.db, setDb: (d: Db) => (h.db = d), state: () => h.state, setState: (s: SyncState) => (h.state = s) },
  }
}
const noPull = async (after: number): Promise<PulledPage> => ({ events: [], lastSeq: after, hasMore: false })
const pullOnce = (events: unknown[], lastSeq = 10): Transport["pull"] => {
  let served = false
  return async (after) => {
    if (served) return { events: [], lastSeq: after, hasMore: false }
    served = true
    return { events, lastSeq, hasMore: false }
  }
}

describe("সার্ভার যে ইভেন্ট নেয়নি তা মুছে যায় না, দেখা যায় (#10)", () => {
  it("একটি খারাপ ইভেন্ট ৪০০ পেলে rejected-এ থাকে (কারণসহ), বাকিগুলো যায়, কিউ খালি হয়, dropped বাড়ে না", async () => {
    const [e1, e2, e3] = [mk("product_upserted"), mk("product_upserted"), mk("product_upserted")] as [SyncEvent, SyncEvent, SyncEvent]
    const { h, io } = harness({ outbox: [e1, e2, e3] })
    const sent: string[] = []
    const transport: Transport = {
      async push(events) {
        if (events.some((e) => e.id === e2.id)) throw apiErr(400, "invalid_input", "ইভেন্ট ২: at সঠিক সময় নয়")
        sent.push(...events.map((e) => e.id))
      },
      pull: noPull,
    }
    expect(await runSync({ io, transport, now: NOW })).toBe("ok")
    expect(sent.sort()).toEqual([e1.id, e3.id].sort())
    expect(h.state.outbox).toEqual([])
    expect(h.state.dropped).toBe(0)
    expect(h.state.rejected).toHaveLength(1)
    expect(h.state.rejected[0]).toMatchObject({ status: 400, code: "invalid_input", message: "ইভেন্ট ২: at সঠিক সময় নয়", rejectedAt: NOW.toISOString() })
    expect(h.state.rejected[0]?.event).toEqual(e2)
  })

  it("৪১৩-ও একইভাবে রাখা হয়", async () => {
    const e = mk("product_upserted")
    const { h, io } = harness({ outbox: [e] })
    const transport: Transport = {
      async push() {
        throw apiErr(413, "payload_too_large")
      },
      pull: noPull,
    }
    await runSync({ io, transport, now: NOW })
    expect(h.state.rejected.map((r) => r.event.id)).toEqual([e.id])
    expect(h.state.outbox).toEqual([])
  })

  it("device_unregistered (৪০০) হলে কিছুই রাখা/বাদ হয় না: কিউ অক্ষত, অবস্থা auth", async () => {
    const e = mk("product_upserted")
    const { h, io } = harness({ outbox: [e] })
    const transport: Transport = {
      async push() {
        throw apiErr(400, "device_unregistered")
      },
      pull: noPull,
    }
    expect(await runSync({ io, transport, now: NOW })).toBe("auth")
    expect(h.state.outbox).toEqual([e])
    expect(h.state.rejected).toEqual([])
  })

  it(`rejected তালিকা ${MAX_KEPT_EVENTS} ছাড়ালে বাকিগুলো কিউতে থাকে, কিছু মুছে যায় না`, async () => {
    const events = Array.from({ length: MAX_KEPT_EVENTS + 2 }, () => mk("product_upserted"))
    const { h, io } = harness({ outbox: events })
    const transport: Transport = {
      async push() {
        throw apiErr(400, "invalid_input")
      },
      pull: noPull,
    }
    await runSync({ io, transport, now: NOW })
    // সীমা পূর্ণ হলে বাকিগুলো মুছে যায় না: কিউতেই থাকে (এটিই তাদের একমাত্র কপি হতে পারে)
    expect(h.state.rejected).toHaveLength(MAX_KEPT_EVENTS)
    expect(h.state.outbox).toHaveLength(2)
    expect(h.state.evicted).toBe(0)
  })

  it("ভাগ করার মাপ বাইট দিয়ে (বাংলা ৩ বাইট), তাই কোনো অনুরোধ সার্ভারের সীমা ছাড়ায় না", async () => {
    const big = "অ".repeat(12_000) // ≈৩৬ KB বাইট, কিন্তু মাত্র ১২ হাজার অক্ষর
    const events = Array.from({ length: 20 }, () => mk("note_upserted", { note: { id: "n", text: big } }))
    const { io } = harness({ outbox: events })
    const sizes: number[] = []
    const transport: Transport = {
      async push(batch) {
        sizes.push(new TextEncoder().encode(JSON.stringify(batch)).length)
      },
      pull: noPull,
    }
    await runSync({ io, transport, now: NOW })
    expect(sizes.length).toBeGreaterThanOrEqual(3)
    for (const s of sizes) expect(s).toBeLessThanOrEqual(PUSH_CHUNK_BYTES + 40_000)
  })

  it("retryRejected: রাখা ইভেন্ট আবার কিউয়ে ওঠে (আগের কিউয়ের পরে, ডুপ্লিকেট ছাড়া), rejected খালি হয়", () => {
    const [a, b] = [mk("product_upserted"), mk("product_upserted")] as [SyncEvent, SyncEvent]
    const st: SyncState = { ...emptySyncState(), outbox: [b], rejected: [{ event: a, status: 400, code: "x", message: "m", rejectedAt: NOW.toISOString() }, { event: b, status: 400, code: "x", message: "m", rejectedAt: NOW.toISOString() }] }
    const out = retryRejected(st)
    expect(out.rejected).toEqual([])
    expect(out.outbox.map((e) => e.id)).toEqual([b.id, a.id])
  })
})

describe("সার্ভার থেকে আসা ইভেন্ট চুপচাপ বাদ যায় না (#5)", () => {
  it("কাঠামো নষ্ট ইভেন্ট malformed-এ গোনা হয়; কার্সর এগোয়; ভালো ইভেন্ট বসে", async () => {
    const made = createProduct(emptyDb(), { name: "ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 100, pricePoisha: 200, minStock: 1, category: "", barcode: "", open: false }, NOW)
    const good = productEvent(uid(), made.product, "2026-11-20T09:00:00.000Z")
    const { h, io } = harness()
    await runSync({ io, transport: { push: async () => {}, pull: pullOnce([{ id: "nope" }, good, 42], 7) }, now: NOW })
    expect(h.state.malformed).toBe(2)
    expect(h.state.cursor).toBe(7)
    expect(h.db.products).toHaveLength(1)
  })

  it("অচেনা ধরন skipped-এ থাকে (unknown_kind), কার্সর এগোয়", async () => {
    const e = mk("future_thing")
    const { h, io } = harness()
    await runSync({ io, transport: { push: async () => {}, pull: pullOnce([e], 5) }, now: NOW })
    expect(h.state.cursor).toBe(5)
    expect(h.state.skipped).toEqual([{ event: e, reason: "unknown_kind", since: NOW.toISOString() }])
  })

  it("চেনা ধরন কিন্তু নষ্ট পেলোড skipped-এ bad_payload", async () => {
    const e = mk("product_upserted", { product: 5 })
    const { h, io } = harness()
    await runSync({ io, transport: { push: async () => {}, pull: pullOnce([e]) }, now: NOW })
    expect(h.state.skipped.map((s) => [s.event.id, s.reason])).toEqual([[e.id, "bad_payload"]])
  })

  it("skipped ইভেন্ট প্রতি সিংকে আবার চেষ্টা হয়: এখন বসানো গেলে বসে ও তালিকা থেকে যায় (অ্যাপ হালনাগাদের পর নিজে ঠিক হওয়ার পথ)", async () => {
    const made = createProduct(emptyDb(), { name: "ক্রিম", unit: "piece", cartonSize: 10, costPoisha: 100, pricePoisha: 200, minStock: 1, category: "", barcode: "", open: false }, NOW)
    const e = productEvent(uid(), made.product, "2026-11-20T09:00:00.000Z")
    const { h, io } = harness({ skipped: [{ event: e, reason: "unknown_kind", since: "2026-11-19T00:00:00.000Z" }] })
    await runSync({ io, transport: { push: async () => {}, pull: noPull }, now: NOW })
    expect(h.db.products).toHaveLength(1)
    expect(h.state.skipped).toEqual([])
  })

  it("আবারও না বসলে skipped-এ একবারই থাকে এবং since বদলায় না", async () => {
    const e = mk("future_thing")
    const since = "2026-11-19T00:00:00.000Z"
    const { h, io } = harness({ skipped: [{ event: e, reason: "unknown_kind", since }] })
    await runSync({ io, transport: { push: async () => {}, pull: noPull }, now: NOW })
    expect(h.state.skipped).toEqual([{ event: e, reason: "unknown_kind", since }])
  })
})

describe("অপেক্ষমাণ ইভেন্ট চিরকাল আটকে থাকলে ধরা পড়ে (#6)", () => {
  const voidEv = () => mk("sale_voided", { saleId: uid(), voided: { at: "2026-11-20T09:00:00.000Z", by: "মালিক", reason: "ভুল" } })

  it("বিলের আগে বাতিল অপেক্ষায় যায়; প্রথম সময় বসে, পরের সিংকে বদলায় না", async () => {
    const e = voidEv()
    const { h, io } = harness()
    await runSync({ io, transport: { push: async () => {}, pull: pullOnce([e]) }, now: NOW })
    expect(h.state.deferred.map((d) => d.id)).toEqual([e.id])
    expect(h.state.deferredSince[e.id]).toBe(NOW.toISOString())
    await runSync({ io, transport: { push: async () => {}, pull: noPull }, now: new Date(NOW.getTime() + 3_600_000) })
    expect(h.state.deferredSince[e.id]).toBe(NOW.toISOString())
  })

  it("trackDeferred: আর অপেক্ষায় না থাকলে এন্ট্রি মুছে যায়", () => {
    const [a, b] = [voidEv(), voidEv()] as [SyncEvent, SyncEvent]
    const first = trackDeferred({}, [a, b], NOW)
    expect(Object.keys(first).sort()).toEqual([a.id, b.id].sort())
    expect(Object.keys(trackDeferred(first, [b], new Date(NOW.getTime() + 1000)))).toEqual([b.id])
  })

  it("stuckDeferred: ২৪ ঘণ্টার বেশি অপেক্ষারত ইভেন্টই ধরা পড়ে", () => {
    const [old, fresh] = [voidEv(), voidEv()] as [SyncEvent, SyncEvent]
    const st = { deferred: [old, fresh], deferredSince: { [old.id]: new Date(NOW.getTime() - 25 * 3_600_000).toISOString(), [fresh.id]: new Date(NOW.getTime() - 3_600_000).toISOString() } }
    expect(stuckDeferred(st, NOW).map((e) => e.id)).toEqual([old.id])
  })
})

describe("classifyError: সিংকের ব্যর্থতার ধরন", () => {
  it.each([
    [{ status: 0 }, "offline"],
    [{ status: 401 }, "auth"],
    [{ status: 403, code: "forbidden" }, "auth"],
    [{ status: 500 }, "server"],
    [{ status: 400, code: "device_unregistered" }, "auth"],
    [{ status: 400, code: "device_limit" }, "device_limit"],
  ])("%j -> %s", (err, want) => {
    expect(classifyError(err)).toBe(want)
  })
})
