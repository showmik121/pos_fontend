import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"

type Listener = (e: unknown) => void

/** sw.js-কে নকল caches/fetch দিয়ে চালায়; ব্রাউজার ছাড়া ক্যাশ-সীমা ও শুধু-সফল-উত্তর যাচাইয়ের জন্য */
function boot(fetchImpl: (req: { url: string; method: string; mode: string }) => Promise<{ ok: boolean; clone(): unknown }>) {
  const stores = new Map<string, Map<string, unknown>>()
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, unknown>()
    stores.set(name, m)
    return {
      put: async (req: { url: string }, res: unknown) => void m.set(req.url, res),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (k: { url: string }) => m.delete(k.url),
      add: async () => {},
    }
  }
  const listeners: Record<string, Listener> = {}
  const ctx = {
    self: { location: { origin: "https://app.test" }, addEventListener: (t: string, l: Listener) => (listeners[t] = l), skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open, match: async () => undefined, keys: async () => [...stores.keys()], delete: async (k: string) => stores.delete(k) },
    fetch: fetchImpl,
    URL,
    Promise,
    Response: { error: () => ({}) },
  }
  runInNewContext(readFileSync("public/sw.js", "utf8"), ctx)
  const request = async (url: string, mode = "cors") => {
    const waits: Promise<unknown>[] = []
    let answer: Promise<unknown> = Promise.resolve()
    listeners.fetch?.({ request: { url, method: "GET", mode }, respondWith: (p: Promise<unknown>) => (answer = p), waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await answer
    await Promise.all(waits)
  }
  return { stores, request }
}

const okRes = { ok: true, clone() { return this } }
const badRes = { ok: false, clone() { return this } }

describe("service worker ক্যাশ", () => {
  it("পেজ ক্যাশ ৬০টির বেশি বাড়ে না, সবচেয়ে পুরনো আগে যায়", async () => {
    const sw = boot(async () => okRes)
    for (let i = 0; i < 80; i++) await sw.request(`https://app.test/dues/customer/?id=${i}`, "navigate")
    const pages = sw.stores.get("pos-pages-v11")!
    expect(pages.size).toBe(60)
    expect(pages.has("https://app.test/dues/customer/?id=79")).toBe(true)
    expect(pages.has("https://app.test/dues/customer/?id=0")).toBe(false)
  })

  it("অ্যাসেট ক্যাশ ১৫০টির বেশি বাড়ে না", async () => {
    const sw = boot(async () => okRes)
    for (let i = 0; i < 200; i++) await sw.request(`https://app.test/_next/static/c${i}.js`)
    expect(sw.stores.get("pos-assets-v11")!.size).toBe(150)
  })

  it("ব্যর্থ উত্তর (৪০৪/৫০০) ক্যাশ হয় না", async () => {
    const sw = boot(async () => badRes)
    await sw.request("https://app.test/nope/", "navigate")
    await sw.request("https://app.test/_next/static/x.js")
    expect(sw.stores.get("pos-pages-v11")?.size ?? 0).toBe(0)
    expect(sw.stores.get("pos-assets-v11")?.size ?? 0).toBe(0)
  })

  it("অন্য origin (API) কখনো ক্যাশ হয় না", async () => {
    const sw = boot(async () => okRes)
    await sw.request("https://api.other.test/v1/me")
    expect(sw.stores.size).toBe(0)
  })
})
