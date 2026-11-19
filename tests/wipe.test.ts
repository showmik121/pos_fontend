import { describe, expect, it } from "vitest"
import { reminderStorageKey } from "../src/lib/store/backup-reminder"
import { dbStorageKey } from "../src/lib/store/db"
import { deviceStorageKey } from "../src/lib/store/device"
import { wipeStoreData } from "../src/lib/store/wipe"

function fakeStorage(initial: Record<string, string>) {
  const m = new Map(Object.entries(initial))
  return {
    m,
    storage: {
      removeItem: (k: string) => void m.delete(k),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() {
        return m.size
      },
    },
  }
}

describe("লগআউটে এই ফোনের ডেটা মোছা", () => {
  it("শুধু ওই দোকানের ডেটা, নষ্ট-ব্যাকআপ, ডিভাইস ও ব্যাকআপ-স্মরণ মোছে; অন্য দোকান ও সেশন-বহির্ভূত কিছু থাকে", () => {
    const { m, storage } = fakeStorage({
      [dbStorageKey("s1")]: "{}",
      [`${dbStorageKey("s1")}.corrupt`]: "x",
      [deviceStorageKey("s1")]: "{}",
      [reminderStorageKey("s1")]: "{}",
      [dbStorageKey("s2")]: "{}",
      [deviceStorageKey("s2")]: "{}",
      "pos.session.v1": "tok",
    })
    wipeStoreData(storage, "s1")
    expect([...m.keys()].sort()).toEqual([dbStorageKey("s2"), deviceStorageKey("s2"), "pos.session.v1"].sort())
  })
  it("স্টোরেজ না থাকলে বা ছুঁড়লে ভাঙে না এবং ব্যর্থ হলে false দেয়", () => {
    expect(wipeStoreData(undefined, "s1")).toBe(false)
    const bad = {
      removeItem: () => {
        throw new Error("blocked")
      },
    }
    expect(wipeStoreData(bad, "s1")).toBe(false)
  })
  it("সফল হলে true", () => {
    const { storage } = fakeStorage({ [dbStorageKey("s1")]: "{}" })
    expect(wipeStoreData(storage, "s1")).toBe(true)
  })
})
