import { afterEach, describe, expect, it, vi } from "vitest"
import { dbStorageKey, emptyDb, readDb } from "../src/lib/store/db"
import { acquireWriter, type LockManagerLike } from "../src/lib/store/tab-lock"

/** Web Locks-এর যতটুকু আমরা ব্যবহার করি, তার নকল: নামভিত্তিক একক লক, ifAvailable ও steal সহ */
function fakeLocks(): LockManagerLike {
  const held = new Map<string, { id: number; abort: () => void }>()
  let seq = 0
  return {
    request(name, options, callback) {
      return new Promise((resolve, reject) => {
        const grant = () => {
          const id = ++seq
          held.set(name, { id, abort: () => reject(Object.assign(new Error("stolen"), { name: "AbortError" })) })
          void Promise.resolve(callback({ name })).then(() => {
            if (held.get(name)?.id === id) held.delete(name)
            resolve(undefined)
          })
        }
        const cur = held.get(name)
        if (!cur) return grant()
        if (options.steal) {
          cur.abort()
          held.delete(name)
          return grant()
        }
        if (options.ifAvailable) {
          void Promise.resolve(callback(null)).then(() => resolve(undefined))
          return
        }
        reject(new Error("fake: waiting locks are not modelled"))
      })
    },
  }
}

const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe("একই দোকান একসময়ে একটি ট্যাবেই লেখা যায় (#15)", () => {
  it("প্রথম ট্যাব writer, দ্বিতীয় (ifAvailable) reader", async () => {
    const locks = fakeLocks()
    const a = await acquireWriter({ storeId: "s1", locks, onLost: () => {} })
    const b = await acquireWriter({ storeId: "s1", locks, onLost: () => {} })
    expect(a.status).toBe("writer")
    expect(b.status).toBe("reader")
  })

  it("অন্য দোকানের লক আলাদা", async () => {
    const locks = fakeLocks()
    await acquireWriter({ storeId: "s1", locks, onLost: () => {} })
    expect((await acquireWriter({ storeId: "s2", locks, onLost: () => {} })).status).toBe("writer")
  })

  it("steal করলে নতুন ট্যাব writer হয়, আর আগেরটি জানতে পারে (onLost একবার)", async () => {
    const locks = fakeLocks()
    const lost = vi.fn()
    await acquireWriter({ storeId: "s1", locks, onLost: lost })
    const b = await acquireWriter({ storeId: "s1", locks, onLost: () => {}, steal: true })
    expect(b.status).toBe("writer")
    await tick()
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it("release করলে onLost ডাকা হয় না, আর পরের ট্যাব writer হতে পারে", async () => {
    const locks = fakeLocks()
    const lost = vi.fn()
    const a = await acquireWriter({ storeId: "s1", locks, onLost: lost })
    if (a.status !== "writer") throw new Error("expected writer")
    a.release()
    await tick()
    expect(lost).not.toHaveBeenCalled()
    expect((await acquireWriter({ storeId: "s1", locks, onLost: () => {} })).status).toBe("writer")
  })

  it("Web Locks না থাকলে unsupported (ব্লক নয়: আগের আচরণে চলে)", async () => {
    expect((await acquireWriter({ storeId: "s1", locks: null, onLost: () => {} })).status).toBe("unsupported")
  })
})

describe("readDb: পড়া না গেলে বা নষ্ট হলে null (ফাঁকা ডেটা নয়), তাই অন্য ট্যাবের বদল নিতে গিয়ে ফাঁকা ডেটা বসে না", () => {
  afterEach(() => vi.unstubAllGlobals())
  const install = (initial: Record<string, string>, failGet = false) => {
    const m = new Map(Object.entries(initial))
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => {
          if (failGet) throw new Error("SecurityError")
          return m.get(k) ?? null
        },
        setItem: (k: string, v: string) => void m.set(k, v),
        removeItem: (k: string) => void m.delete(k),
      },
    })
    return m
  }

  it("ভালো ডেটা দেয়", () => {
    install({ [dbStorageKey("s1")]: JSON.stringify(emptyDb()) })
    expect(readDb("s1")?.billCounter).toBe(emptyDb().billCounter)
  })
  it("কিছু নেই → null", () => {
    install({})
    expect(readDb("s1")).toBeNull()
  })
  it("JSON ভাঙা → null", () => {
    install({ [dbStorageKey("s1")]: "{broken" })
    expect(readDb("s1")).toBeNull()
  })
  it("পড়তে ছুঁড়লে → null", () => {
    install({}, true)
    expect(readDb("s1")).toBeNull()
  })
})
