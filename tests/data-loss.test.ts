import { afterEach, describe, expect, it, vi } from "vitest"
import { dbStorageKey, emptyDb, loadDb, saveDb } from "../src/lib/store/db"
import { planCommit } from "../src/lib/sync/commit"
import { createProduct } from "../src/lib/store/actions"
import { emptySyncState } from "../src/lib/sync/state"
import type { Db } from "../src/lib/store/types"

function installStorage(initial: Record<string, string> = {}, opts: { failWrites?: boolean } = {}) {
  const m = new Map(Object.entries(initial))
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error("QuotaExceededError")
      m.set(k, v)
    },
    removeItem: (k: string) => void m.delete(k),
  }
  vi.stubGlobal("window", { localStorage: storage })
  return m
}

afterEach(() => vi.unstubAllGlobals())

describe("নষ্ট স্থানীয় ডেটা চুপচাপ ফাঁকা ডেটায় বদলে যায় না", () => {
  const KEY = dbStorageKey("s1")
  const CORRUPT = `${KEY}.corrupt`

  it("JSON ভাঙা হলে কাঁচা লেখা `.corrupt` কপিতে রেখে তারপর ফাঁকা ডেটা দেয়", () => {
    const m = installStorage({ [KEY]: '{"v":1,"products":[' })
    const db = loadDb("s1")
    expect(db.products).toEqual([])
    expect(m.get(CORRUPT)).toBe('{"v":1,"products":[')
  })

  it("কাঠামো ভুল (বৈধ JSON) হলেও কপি থাকে", () => {
    const m = installStorage({ [KEY]: '{"v":2}' })
    loadDb("s1")
    expect(m.get(CORRUPT)).toBe('{"v":2}')
  })

  it("আগের কপি নতুন নষ্ট লেখা দিয়ে ঘষা হয় না (আসল ডেটা বাঁচে)", () => {
    const m = installStorage({ [KEY]: "broken-2", [CORRUPT]: "original-corrupt" })
    loadDb("s1")
    expect(m.get(CORRUPT)).toBe("original-corrupt")
  })

  it("ভালো ডেটায় কোনো কপি বানায় না", () => {
    const m = installStorage({ [KEY]: JSON.stringify(emptyDb()) })
    loadDb("s1")
    expect(m.has(CORRUPT)).toBe(false)
  })

  it("saveDb ব্যর্থ হলে false", () => {
    installStorage({}, { failWrites: true })
    expect(saveDb("s1", emptyDb())).toBe(false)
  })
})

const addProduct = (db: Db, name: string) =>
  createProduct(db, { name, unit: "piece", cartonSize: 10, costPoisha: 18000, pricePoisha: 24000, minStock: 5, category: "", barcode: "", open: false }, new Date("2026-11-20T10:00:00Z"))

describe("planCommit: ইভেন্ট তৈরি ব্যর্থ হলেও বদল হারায় না, আর সেটা লুকায়ও না", () => {
  const NOW = new Date("2026-11-20T10:00:00Z")
  const ids = () => {
    let n = 0
    return () => `id-${++n}`
  }

  it("সাধারণ বদলে ইভেন্ট কিউতে যায়, queueFailed false", () => {
    const prev = emptyDb()
    const next = addProduct(prev, "ফেসওয়াশ").db
    const out = planCommit(prev, next, { ...emptySyncState(), seeded: true }, ids(), NOW)
    expect(out.queueFailed).toBe(false)
    expect(out.state.outbox.length).toBeGreaterThan(0)
    expect(out.db.products).toHaveLength(1)
  })

  it("ইভেন্ট তৈরি ছুঁড়লে বদল ঠিক থাকে, queueFailed true, আর পরের লোডে সব আবার তোলার জন্য seeded=false হয়", () => {
    const prev = emptyDb()
    const next = addProduct(prev, "ফেসওয়াশ").db
    const st = { ...emptySyncState(), seeded: true }
    const out = planCommit(
      prev,
      next,
      st,
      () => {
        throw new Error("boom")
      },
      NOW,
    )
    expect(out.queueFailed).toBe(true)
    expect(out.db).toBe(next)
    expect(out.state.seeded).toBe(false)
    expect(out.state.outbox).toEqual(st.outbox)
  })
})

import { restoredDb } from "../src/lib/store/backup"

describe("ব্যাকআপ ফেরানো: বিল নম্বর পিছিয়ে গিয়ে পুরনো নম্বর আবার দেয় না", () => {
  it("ব্যাকআপের চেয়ে এখনকার কাউন্টার বড় হলে বড়টাই থাকে", () => {
    const current = { ...emptyDb(), billCounter: 1050 }
    const backup = { ...emptyDb(), billCounter: 1010 }
    expect(restoredDb(current, backup).billCounter).toBe(1050)
  })

  it("ব্যাকআপের কাউন্টার বড় হলে সেটিই", () => {
    const current = { ...emptyDb(), billCounter: 1001 }
    const backup = { ...emptyDb(), billCounter: 1200 }
    expect(restoredDb(current, backup).billCounter).toBe(1200)
  })

  it("বাকি সব তথ্য ব্যাকআপ থেকেই আসে", () => {
    const backup = addProduct(emptyDb(), "ফেসওয়াশ").db
    expect(restoredDb(emptyDb(), backup).products).toHaveLength(1)
  })
})
