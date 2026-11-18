import { describe, expect, it } from "vitest"
import { rescueBackup } from "../src/lib/store/rescue"
import { parseBackup } from "../src/lib/store/backup"
import { emptyDb } from "../src/lib/store/db"

const NOW = new Date("2026-11-18T10:00:00+06:00")

function fakeStorage(entries: Record<string, string>) {
  const keys = Object.keys(entries)
  return {
    get length() {
      return keys.length
    },
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => entries[k] ?? null,
  }
}

const session = (storeId: string) => JSON.stringify({ token: "t", user: { id: "u" }, store: { id: storeId } })

describe("ক্র্যাশের পর ডেটা উদ্ধার", () => {
  it("সচল ডেটা হলে অ্যাপের ব্যাকআপ ফরম্যাটে দেয়, যা আবার ফেরানো যায়", () => {
    const db = { ...emptyDb(), billCounter: 1005 }
    const out = rescueBackup(fakeStorage({ "pos.session.v1": session("s1"), "pos.db.v1.s1": JSON.stringify(db) }), NOW)
    expect(out?.fileName).toBe("pos-backup-2026-11-18.json")
    expect(parseBackup(out!.text, "s1").db.billCounter).toBe(1005)
  })

  it("ডেটা নষ্ট হলে কাঁচা লেখাটাই আলাদা নামে দেয়, হারায় না", () => {
    const out = rescueBackup(fakeStorage({ "pos.session.v1": session("s1"), "pos.db.v1.s1": '{"v":1,"products":[' }), NOW)
    expect(out?.fileName).toBe("pos-raw-2026-11-18.json")
    expect(out?.text).toBe('{"v":1,"products":[')
  })

  it("সেশন না থাকলে প্রথম দোকানের ডেটা নেয়, .corrupt কপি বাদ দেয়", () => {
    const db = JSON.stringify(emptyDb())
    const out = rescueBackup(fakeStorage({ "pos.db.v1.s9.corrupt": "x", "pos.db.v1.s9": db }), NOW)
    expect(parseBackup(out!.text, "s9").db.v).toBe(1)
  })

  it("ডেটা না থাকলে null", () => {
    expect(rescueBackup(fakeStorage({}), NOW)).toBeNull()
    expect(rescueBackup(fakeStorage({ "pos.session.v1": session("s1") }), NOW)).toBeNull()
  })

  it("স্টোরেজ ছুঁড়লে বা সেশন নষ্ট হলে ভেঙে পড়ে না", () => {
    const broken = { length: 1, key: () => { throw new Error("x") }, getItem: () => { throw new Error("x") } }
    expect(rescueBackup(broken, NOW)).toBeNull()
    const out = rescueBackup(fakeStorage({ "pos.session.v1": "{bad", "pos.db.v1.s1": JSON.stringify(emptyDb()) }), NOW)
    expect(out).not.toBeNull()
  })
})
