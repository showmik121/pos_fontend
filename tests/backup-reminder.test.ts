import { describe, expect, it } from "vitest"
import { markBackedUp, parseReminderState, shouldRemindBackup, snoozeToday, loadReminderState } from "../src/lib/store/backup-reminder"
import { requestPersistentStorage } from "../src/lib/browser/persist"
import { emptyDb } from "../src/lib/store/db"
import type { Db, Sale } from "../src/lib/store/types"

const MON = new Date("2026-11-16T10:00:00+06:00")
const TUE = new Date("2026-11-17T10:00:00+06:00")
const none = { lastBackupAt: null, snoozedOn: null }

function dbWithSaleAt(iso: string): Db {
  const sale = { id: "s", no: 1001, at: iso } as Sale
  return { ...emptyDb(), sales: [sale], billCounter: 1001 }
}

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe("ব্যাকআপ স্মরণ কখন", () => {
  it("ডেটা না থাকলে (ফাঁকা দোকান) বলে না", () => {
    expect(shouldRemindBackup(emptyDb(), none, MON)).toBe(false)
  })
  it("ডেটা আছে কিন্তু কখনো ব্যাকআপ নেওয়া হয়নি: বলে", () => {
    expect(shouldRemindBackup(dbWithSaleAt(MON.toISOString()), none, MON)).toBe(true)
  })
  it("আজই ব্যাকআপ নেওয়া হয়েছে: বলে না, নতুন বিক্রি হলেও", () => {
    const state = { lastBackupAt: MON.toISOString(), snoozedOn: null }
    expect(shouldRemindBackup(dbWithSaleAt("2026-11-16T18:00:00+06:00"), state, MON)).toBe(false)
  })
  it("গতকাল ব্যাকআপ, তারপর নতুন বিক্রি: আজ বলে", () => {
    const state = { lastBackupAt: MON.toISOString(), snoozedOn: null }
    expect(shouldRemindBackup(dbWithSaleAt("2026-11-16T18:00:00+06:00"), state, TUE)).toBe(true)
  })
  it("গতকাল ব্যাকআপ, তারপর কোনো বদল নেই: বলে না", () => {
    const state = { lastBackupAt: MON.toISOString(), snoozedOn: null }
    expect(shouldRemindBackup(dbWithSaleAt("2026-11-16T09:00:00+06:00"), state, TUE)).toBe(false)
  })
  it("আজ 'পরে' চাপলে আজ আর বলে না, কাল আবার বলে", () => {
    const state = { lastBackupAt: null, snoozedOn: "2026-11-16" }
    const db = dbWithSaleAt(MON.toISOString())
    expect(shouldRemindBackup(db, state, MON)).toBe(false)
    expect(shouldRemindBackup(db, state, TUE)).toBe(true)
  })
  it("শুধু পণ্য যোগ করা (বিক্রি নেই) ডেটা হিসেবে ধরে", () => {
    const db = { ...emptyDb(), products: [{ id: "p" } as Db["products"][number]] }
    expect(shouldRemindBackup(db, none, MON)).toBe(true)
  })
})

describe("স্মরণের অবস্থা সংরক্ষণ", () => {
  it("নষ্ট বা অচেনা লেখা পেলে ফাঁকা অবস্থা", () => {
    expect(parseReminderState("{bad")).toEqual(none)
    expect(parseReminderState(JSON.stringify({ lastBackupAt: 5, snoozedOn: [] }))).toEqual(none)
    expect(parseReminderState(null)).toEqual(none)
  })
  it("ব্যাকআপ নিলে সময় লেখে, snooze মুছে যায়", () => {
    const s = memoryStorage()
    snoozeToday("s1", MON, s)
    markBackedUp("s1", MON, s)
    expect(loadReminderState("s1", s)).toEqual({ lastBackupAt: MON.toISOString(), snoozedOn: null })
  })
  it("snooze আজকের তারিখ রাখে, ব্যাকআপের সময় ঠিক থাকে", () => {
    const s = memoryStorage()
    markBackedUp("s1", MON, s)
    snoozeToday("s1", TUE, s)
    expect(loadReminderState("s1", s)).toEqual({ lastBackupAt: MON.toISOString(), snoozedOn: "2026-11-17" })
  })
  it("স্টোরেজ ছুঁড়লে ভেঙে পড়ে না", () => {
    const broken = { getItem: () => { throw new Error("x") }, setItem: () => { throw new Error("x") } }
    expect(loadReminderState("s1", broken)).toEqual(none)
    expect(() => markBackedUp("s1", MON, broken)).not.toThrow()
  })
})

describe("স্থায়ী স্টোরেজ চাওয়া", () => {
  it("API না থাকলে null", async () => {
    expect(await requestPersistentStorage(undefined)).toBeNull()
  })
  it("আগেই স্থায়ী হলে persist() ডাকে না", async () => {
    let called = false
    const sm = { persisted: async () => true, persist: async () => { called = true; return true } }
    expect(await requestPersistentStorage(sm)).toBe(true)
    expect(called).toBe(false)
  })
  it("স্থায়ী না হলে persist() এর ফল দেয়", async () => {
    expect(await requestPersistentStorage({ persisted: async () => false, persist: async () => true })).toBe(true)
    expect(await requestPersistentStorage({ persisted: async () => false, persist: async () => false })).toBe(false)
  })
  it("ছুঁড়লে false", async () => {
    expect(await requestPersistentStorage({ persisted: async () => { throw new Error("x") }, persist: async () => true })).toBe(false)
  })
})
