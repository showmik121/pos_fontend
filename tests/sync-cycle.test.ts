import { describe, expect, it, vi } from "vitest"
import { runSyncCycle, type CycleDeps } from "../src/lib/sync/cycle"
import type { SyncStatus, Transport } from "../src/lib/sync/engine"
import type { SyncEvent } from "../src/lib/sync/events"

const apiErr = (status: number, code = "") => Object.assign(new Error("x"), { status, code })
const ev: SyncEvent = { id: "00000000-0000-4000-8000-000000000001", kind: "product_upserted", at: "2026-11-20T09:00:00.000Z", payload: {} }

function deps(over: Partial<CycleDeps> = {}) {
  const noted: SyncStatus[] = []
  const reported: unknown[] = []
  const d: CycleDeps = {
    device: () => ({ id: "dev-1", code: null }),
    saveDeviceCode: vi.fn(),
    registerDevice: vi.fn(async () => "A"),
    pushEvents: vi.fn(async () => {}),
    pullEvents: vi.fn(async (after: number) => ({ events: [], lastSeq: after, hasMore: false })),
    syncNow: vi.fn(async (t: Transport) => {
      await t.push([ev])
      return "ok" as const
    }),
    note: (s) => void noted.push(s),
    report: (e) => void reported.push(e),
    ...over,
  }
  return { d, noted, reported }
}

describe("সিংক-চক্র: ব্যর্থতা চুপ থাকে না, ছুঁড়েও বেরোয় না (#9, #8)", () => {
  it("কোড না থাকলে নিবন্ধন করে কোড সেভ করে, তারপর ওই device id দিয়ে সিংক চালায়", async () => {
    const { d } = deps()
    expect(await runSyncCycle(d)).toBe("ok")
    expect(d.registerDevice).toHaveBeenCalledWith("dev-1")
    expect(d.saveDeviceCode).toHaveBeenCalledWith("A")
    expect(d.pushEvents).toHaveBeenCalledWith("dev-1", [ev])
  })

  it("কোড আগে থেকে থাকলে আবার নিবন্ধন করে না", async () => {
    const { d } = deps({ device: () => ({ id: "dev-1", code: "B" }) })
    await runSyncCycle(d)
    expect(d.registerDevice).not.toHaveBeenCalled()
  })

  it.each([
    [apiErr(400, "device_limit"), "device_limit"],
    [apiErr(401), "auth"],
    [apiErr(0), "offline"],
    [apiErr(503), "server"],
  ] as const)("নিবন্ধন %j ব্যর্থ হলে অবস্থা %s জানানো হয় (আগে চুপচাপ ফিরত), সিংক চলে না", async (err, status) => {
    const { d, noted } = deps({ registerDevice: vi.fn(async () => Promise.reject(err)) })
    expect(await runSyncCycle(d)).toBe(status)
    expect(noted).toEqual([status])
    expect(d.syncNow).not.toHaveBeenCalled()
  })

  it("সিংক অপ্রত্যাশিত ত্রুটি ছুঁড়লে বাইরে ছোঁড়ে না (unhandled rejection নয়): রিপোর্ট হয়, অবস্থা error", async () => {
    const boom = new Error("boom")
    const { d, noted, reported } = deps({ syncNow: vi.fn(async () => Promise.reject(boom)) })
    await expect(runSyncCycle(d)).resolves.toBe("error")
    expect(noted).toEqual(["error"])
    expect(reported).toEqual([boom])
  })

  it("অন্য সিংক চলছে (busy) হলে কিছু জানায় না", async () => {
    const { d, noted } = deps({ syncNow: vi.fn(async () => "busy" as const) })
    expect(await runSyncCycle(d)).toBe("busy")
    expect(noted).toEqual([])
  })
})
