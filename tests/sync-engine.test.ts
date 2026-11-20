import { describe, expect, it } from "vitest"
import { addCustomer, addToCart, completeSale, createProduct, receiveDue, removeBatch, setCartCustomer, stockIn, updateProduct, voidSale } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { customerBalance, totalStock } from "../src/lib/store/selectors"
import type { Db } from "../src/lib/store/types"
import { eventsFromChange } from "../src/lib/sync/diff"
import { runSync, type Transport } from "../src/lib/sync/engine"
import type { SyncEvent } from "../src/lib/sync/events"
import { uuidFrom } from "../src/lib/sync/ids"
import { applyEvents } from "../src/lib/sync/replay"
import { seedEvents } from "../src/lib/sync/seed"
import { emptySyncState, parseSyncState, type SyncState } from "../src/lib/sync/state"

const T = (m: number) => new Date(Date.UTC(2026, 10, 12, 4, m, 0))
let n = 0
const uid = () => uuidFrom(`t${++n}`)

/** একটি "ফোন": Db + সিংক অবস্থা; অ্যাকশন চালালে diff থেকে ইভেন্ট কিউতে যায় */
function phone() {
  const p = { db: emptyDb(), sync: emptySyncState() as SyncState }
  return {
    p,
    act(fn: (db: Db) => Db, at: number) {
      const next = fn(p.db)
      const out = eventsFromChange(p.db, next, uid, T(at))
      p.db = out.db
      p.sync = { ...p.sync, outbox: [...p.sync.outbox, ...out.events] }
    },
  }
}

/** সার্ভার: ইভেন্ট লগ, id ধরে ডুপ্লিকেট বাদ */
function server() {
  const log: Array<SyncEvent & { seq: number }> = []
  const t: Transport = {
    async push(events) {
      for (const e of events) if (!log.some((x) => x.id === e.id)) log.push({ ...e, seq: log.length + 1 })
    },
    async pull(after, limit) {
      const events = log.filter((e) => e.seq > after).slice(0, limit)
      const lastSeq = events.at(-1)?.seq ?? after
      return { events, lastSeq, hasMore: log.some((e) => e.seq > lastSeq) }
    },
  }
  return { log, t }
}

async function sync(ph: ReturnType<typeof phone>, t: Transport) {
  return runSync({
    io: { db: () => ph.p.db, setDb: (d) => (ph.p.db = d), state: () => ph.p.sync, setState: (st) => (ph.p.sync = st) },
    transport: t,
    now: T(59),
  })
}

const prod = { name: "পন্ডস ক্রিম", unit: "piece" as const, cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "890", open: false }

describe("দুই ফোন সিংক", () => {
  it("ফোন ১-এর কাজ ফোন ২-এ পৌঁছায়, নিজের ইভেন্ট ফিরে এলে দ্বিগুণ হয় না", async () => {
    const s = server()
    const a = phone()
    const b = phone()
    let pid = ""
    a.act((db) => { const m = createProduct(db, prod, T(0)); pid = m.product.id; return m.db }, 0)
    a.act((db) => stockIn(db, { productId: pid, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, T(1)), 1)
    let custId = ""
    a.act((db) => { const m = addCustomer(db, { name: "করিম", phone: "" }, T(2)); custId = m.customer.id; return m.db }, 2)
    a.act((db) => completeSale({ ...db, draft: setCartCustomer(addToCart(db.draft, pid, 4), custId) }, { cashier: "রুবেল", cash: 20000, mobile: 0, mobileMethod: "bkash" }, T(3)).db, 3)
    expect(await sync(a, s.t)).toBe("ok")
    expect(a.p.sync.outbox).toHaveLength(0)
    expect(totalStock(a.p.db, pid)).toBe(26) // নিজের ইভেন্ট ফিরে এলেও একই
    expect(await sync(b, s.t)).toBe("ok")
    expect(totalStock(b.p.db, pid)).toBe(26)
    expect(customerBalance(b.p.db, custId)).toBe(customerBalance(a.p.db, custId))
    expect(b.p.db.sales).toHaveLength(1)
  })

  it("বাতিল ও বাকি আদায় দুই ফোনে মেলে, দ্বিতীয় সিংকে কিছু বদলায় না", async () => {
    const s = server()
    const a = phone()
    const b = phone()
    let pid = "", custId = "", saleId = ""
    a.act((db) => { const m = createProduct(db, prod, T(0)); pid = m.product.id; return m.db }, 0)
    a.act((db) => stockIn(db, { productId: pid, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, T(1)), 1)
    a.act((db) => { const m = addCustomer(db, { name: "করিম", phone: "" }, T(2)); custId = m.customer.id; return m.db }, 2)
    a.act((db) => { const m = completeSale({ ...db, draft: setCartCustomer(addToCart(db.draft, pid, 4), custId) }, { cashier: "রুবেল", cash: 20000, mobile: 0, mobileMethod: "bkash" }, T(3)); saleId = m.sale.id; return m.db }, 3)
    a.act((db) => receiveDue(db, custId, 1000, "রুবেল", T(4)), 4)
    await sync(a, s.t)
    await sync(b, s.t)
    b.act((db) => voidSale(db, saleId, { by: "মালিক", reason: "ভুল" }, T(5)).db, 5)
    await sync(b, s.t)
    await sync(a, s.t)
    for (const ph of [a, b]) {
      expect(totalStock(ph.p.db, pid)).toBe(30)
      expect(ph.p.db.sales[0]?.voided?.by).toBe("মালিক")
    }
    expect(customerBalance(a.p.db, custId)).toBe(customerBalance(b.p.db, custId))
    const before = JSON.stringify(a.p.db.ledger)
    await sync(a, s.t)
    expect(JSON.stringify(a.p.db.ledger)).toBe(before)
  })

  it("পণ্যের দাম দুই ফোনে বদলালে শেষ-বদল জেতে", async () => {
    const s = server()
    const a = phone()
    const b = phone()
    let pid = ""
    a.act((db) => { const m = createProduct(db, prod, T(0)); pid = m.product.id; return m.db }, 0)
    await sync(a, s.t)
    await sync(b, s.t)
    const edit = (price: number) => (db: Db) => updateProduct(db, pid, { name: prod.name, unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: price, minStock: 5, category: "" })
    a.act(edit(25000), 10)
    b.act(edit(26000), 11)
    await sync(a, s.t)
    await sync(b, s.t)
    await sync(a, s.t)
    expect(a.p.db.products[0]?.pricePoisha).toBe(26000)
    expect(b.p.db.products[0]?.pricePoisha).toBe(26000)
  })

  it("অফলাইনে কিউ জমে, নেটওয়ার্ক এলে যায়; ব্যর্থ হলে কিছু হারায় না", async () => {
    const s = server()
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    const down: Transport = { push: async () => { throw Object.assign(new Error("net"), { status: 0 }) }, pull: async () => { throw Object.assign(new Error("net"), { status: 0 }) } }
    expect(await sync(a, down)).toBe("offline")
    expect(a.p.sync.outbox).toHaveLength(1)
    expect(await sync(a, s.t)).toBe("ok")
    expect(a.p.sync.outbox).toHaveLength(0)
    expect(s.log).toHaveLength(1)
  })

  it("পাঠানোর মাঝে নতুন স্থানীয় বদল হারায় না", async () => {
    const s = server()
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    const racing: Transport = {
      push: async (events) => {
        await s.t.push(events)
        a.act((db) => addCustomer(db, { name: "মাঝপথে", phone: "" }, T(1)).db, 1)
      },
      pull: s.t.pull,
    }
    await sync(a, racing)
    expect(a.p.db.customers).toHaveLength(1)
    expect(a.p.sync.outbox).toHaveLength(1)
    await sync(a, s.t)
    expect(a.p.sync.outbox).toHaveLength(0)
    expect(a.p.db.customers).toHaveLength(1)
  })

  it("সেশন শেষ হলে (401) থামে, কিউ থাকে", async () => {
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    const t: Transport = { push: async () => { throw Object.assign(new Error("x"), { status: 401 }) }, pull: async () => ({ events: [], lastSeq: 0, hasMore: false }) }
    expect(await sync(a, t)).toBe("auth")
    expect(a.p.sync.outbox).toHaveLength(1)
  })

  it("সার্ভার একটি খারাপ ইভেন্ট নিতে না চাইলে (400) বাকিগুলো যায়; খারাপটি কিউ থেকে সরে rejected-এ থাকে (মুছে যায় না, #10)", async () => {
    const s = server()
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    a.act((db) => addCustomer(db, { name: "করিম", phone: "" }, T(1)).db, 1)
    const badId = a.p.sync.outbox[0]!.id
    const picky: Transport = {
      push: async (events) => {
        if (events.some((e) => e.id === badId)) throw Object.assign(new Error("bad"), { status: 400 })
        await s.t.push(events)
      },
      pull: s.t.pull,
    }
    expect(await sync(a, picky)).toBe("ok")
    expect(a.p.sync.outbox).toHaveLength(0)
    expect(a.p.sync.dropped).toBe(0)
    expect(a.p.sync.rejected.map((r) => r.event.id)).toEqual([badId])
    expect(s.log).toHaveLength(1)
  })

  it("সার্ভার বলে এই ব্যবহারকারীর এই ইভেন্ট পাঠানোর অনুমতি নেই (403 forbidden): ইভেন্টটি আটকে রাখা হয় (বাদ নয়), বাকিগুলো যায়, সারি আটকায় না; মালিক সিংক করলে যায়", async () => {
    const s = server()
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    a.act((db) => addCustomer(db, { name: "করিম", phone: "" }, T(1)).db, 1)
    const heldId = a.p.sync.outbox[0]!.id
    const staffOnly: Transport = {
      push: async (events) => {
        if (events.some((e) => e.id === heldId)) throw Object.assign(new Error("forbidden"), { status: 403, code: "forbidden" })
        await s.t.push(events)
      },
      pull: s.t.pull,
    }
    expect(await sync(a, staffOnly)).toBe("ok")
    // কর্মচারীর সিংকে মালিকের কিউ-করা ইভেন্ট হারায় না: কিউতে থেকে যায়, বাদ-গোনা বাড়ে না
    expect(a.p.sync.outbox.map((e) => e.id)).toEqual([heldId])
    expect(a.p.sync.dropped).toBe(0)
    expect(s.log).toHaveLength(1)
    // পরে মালিক (অনুমতি আছে) সিংক করলে ইভেন্টটি যায়
    expect(await sync(a, s.t)).toBe("ok")
    expect(a.p.sync.outbox).toHaveLength(0)
    expect(s.log).toHaveLength(2)
  })

  it("অনুমতির ত্রুটি ছাড়া সাধারণ 403/401 (টোকেন সমস্যা) হলে ইভেন্ট বাদ যায় না, অবস্থা auth", async () => {
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    const t: Transport = { push: async () => { throw Object.assign(new Error("x"), { status: 403 }) }, pull: async () => ({ events: [], lastSeq: 0, hasMore: false }) }
    expect(await sync(a, t)).toBe("auth")
    expect(a.p.sync.outbox).toHaveLength(1)
    expect(a.p.sync.dropped).toBe(0)
  })

  it("ডিভাইস নিবন্ধিত না থাকলে ইভেন্ট বাদ যায় না", async () => {
    const a = phone()
    a.act((db) => createProduct(db, prod, T(0)).db, 0)
    const t: Transport = { push: async () => { throw Object.assign(new Error("x"), { status: 400, code: "device_unregistered" }) }, pull: async () => ({ events: [], lastSeq: 0, hasMore: false }) }
    expect(await sync(a, t)).toBe("auth")
    expect(a.p.sync.outbox).toHaveLength(1)
    expect(a.p.sync.dropped).toBe(0)
  })

  it("বহু ইভেন্ট একাধিক পাতায় আসে", async () => {
    const s = server()
    const a = phone()
    for (let i = 0; i < 450; i++) a.act((db) => addCustomer(db, { name: `ক${i}`, phone: "" }, T(0)).db, 0)
    await sync(a, s.t)
    const b = phone()
    await sync(b, s.t)
    expect(b.p.db.customers).toHaveLength(450)
    expect(b.p.sync.cursor).toBe(450)
  })

  it("নষ্ট সেভ-করা অবস্থা পার্স হয় না", () => {
    expect(parseSyncState("{")).toBeNull()
    expect(parseSyncState(JSON.stringify({ cursor: 3, outbox: [], deferred: [] }))?.cursor).toBe(3)
  })
})

describe("পুরনো ডেটা আপলোড (seed)", () => {
  function legacy() {
    const a = phone()
    let pid = "", custId = "", batchId = "", saleId = ""
    a.act((db) => { const m = createProduct(db, prod, T(0)); pid = m.product.id; return m.db }, 0)
    a.act((db) => stockIn(db, { productId: pid, qty: 30, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, T(1)), 1)
    a.act((db) => stockIn(db, { productId: pid, qty: 5, unit: "piece", batchNo: "B2", expiryDate: "2027-07-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, T(1)), 1)
    a.act((db) => { const m = addCustomer(db, { name: "করিম", phone: "" }, T(2)); custId = m.customer.id; return m.db }, 2)
    a.act((db) => { const m = completeSale({ ...db, draft: setCartCustomer(addToCart(db.draft, pid, 4), custId) }, { cashier: "রুবেল", cash: 20000, mobile: 0, mobileMethod: "bkash" }, T(3)); saleId = m.sale.id; return m.db }, 3)
    a.act((db) => receiveDue(db, custId, 1000, "রুবেল", T(4)), 4)
    a.act((db) => voidSale(db, saleId, { by: "মালিক", reason: "ভুল" }, T(5)).db, 5)
    batchId = a.p.db.batches[1]!.id
    a.act((db) => removeBatch(db, batchId, { by: "মালিক", reason: "মেয়াদ শেষ" }, T(6)), 6)
    // সিংকের আগের অবস্থা: ইভেন্ট/ঘড়ি/rcpt নেই
    const old: Db = JSON.parse(JSON.stringify(a.p.db))
    delete old.sync
    old.batches = old.batches.map(({ rcpt: _r, ...b }) => b)
    old.removedBatches = old.removedBatches!.map(({ batchId: _b, ...r }) => r)
    old.ledger = old.ledger.map((l) => (l.id.startsWith("void:") ? { ...l, id: uid() } : l))
    return { old, pid, custId }
  }

  it("পুরনো ডেটা থেকে খালি ফোনে একই অবস্থা তৈরি হয়", () => {
    const { old, pid, custId } = legacy()
    const seeded = seedEvents(old)
    const r = applyEvents(emptyDb(), seeded.events)
    expect(r.deferred).toHaveLength(0)
    expect(totalStock(r.db, pid)).toBe(totalStock(old, pid))
    expect(customerBalance(r.db, custId)).toBe(customerBalance(old, custId))
    expect(r.db.sales[0]?.voided?.reason).toBe("ভুল")
    expect(r.db.removedBatches).toHaveLength(1)
  })

  it("একই পুরনো ডেটা দুই ফোন থেকে গেলেও স্টক দ্বিগুণ হয় না", async () => {
    const { old, pid } = legacy()
    const s = server()
    const a = phone(), b = phone()
    for (const ph of [a, b]) {
      const seeded = seedEvents(JSON.parse(JSON.stringify(old)) as Db)
      ph.p.db = seeded.db
      ph.p.sync = { ...ph.p.sync, outbox: seeded.events, seeded: true }
    }
    await sync(a, s.t)
    await sync(b, s.t)
    await sync(a, s.t)
    expect(totalStock(a.p.db, pid)).toBe(totalStock(old, pid))
    expect(totalStock(b.p.db, pid)).toBe(totalStock(old, pid))
    expect(a.p.db.sales).toHaveLength(1)
  })

  it("সিডের পর নতুন বিক্রি অন্য ফোনে ঠিক পৌঁছায়", async () => {
    const { old, pid } = legacy()
    const s = server()
    const a = phone(), b = phone()
    const seeded = seedEvents(old)
    a.p.db = seeded.db
    a.p.sync = { ...a.p.sync, outbox: seeded.events, seeded: true }
    await sync(a, s.t)
    await sync(b, s.t)
    a.act((db) => stockIn(db, { productId: pid, qty: 10, unit: "piece", batchNo: "B1", expiryDate: "2027-06-30", costPoisha: 20000, pricePoisha: null, requireBatchAndExpiry: true }, T(20)), 20)
    await sync(a, s.t)
    await sync(b, s.t)
    expect(totalStock(b.p.db, pid)).toBe(totalStock(a.p.db, pid))
  })
})
