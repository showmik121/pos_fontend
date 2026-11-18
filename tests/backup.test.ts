import { describe, expect, it } from "vitest"
import { BACKUP_MAX_BYTES, backupFileName, buildBackup, parseBackup, storageStatus } from "../src/lib/store/backup"
import { emptyDb } from "../src/lib/store/db"
import { createProduct } from "../src/lib/store/actions"

const NOW = new Date("2026-11-18T19:00:00+06:00")
const STORE = "11111111-1111-1111-1111-111111111111"

function sampleDb() {
  return createProduct(emptyDb(), { name: "পন্ডস", unit: "piece", cartonSize: 10, costPoisha: 20000, pricePoisha: 24000, minStock: 5, category: "", barcode: "890", open: false }, NOW).db
}

describe("ব্যাকআপ", () => {
  it("তৈরি করে আবার পড়লে ডেটা হুবহু ফেরে", () => {
    const db = sampleDb()
    const text = buildBackup(db, STORE, NOW)
    const out = parseBackup(text, STORE)
    expect(out.db).toEqual(db)
    expect(out.exportedAt).toBe(NOW.toISOString())
  })
  it("অন্য দোকানের ব্যাকআপ বাতিল হয়", () => {
    const text = buildBackup(sampleDb(), STORE, NOW)
    expect(() => parseBackup(text, "22222222-2222-2222-2222-222222222222")).toThrow(/অন্য দোকান/)
  })
  it("JSON নয় বা ভুল কাঠামো বাতিল হয়", () => {
    expect(() => parseBackup("not json", STORE)).toThrow()
    expect(() => parseBackup(JSON.stringify({ app: "other" }), STORE)).toThrow()
    expect(() => parseBackup(JSON.stringify({ app: "pos-backup", version: 1, storeId: STORE, exportedAt: "x", db: { v: 1 } }), STORE)).toThrow()
  })
  it("অতিরিক্ত বড় ফাইল বাতিল হয়", () => {
    expect(() => parseBackup("x".repeat(BACKUP_MAX_BYTES + 1), STORE)).toThrow(/বড়/)
  })
  it("ফাইলের নামে তারিখ থাকে", () => {
    expect(backupFileName(NOW)).toBe("pos-backup-2026-11-18.json")
  })
})

describe("স্টোরেজ অবস্থা", () => {
  it("ব্যবহারের হার ও সতর্কতার ধাপ", () => {
    expect(storageStatus(100_000).level).toBe("ok")
    expect(storageStatus(3_000_000).level).toBe("warn")
    expect(storageStatus(4_500_000).level).toBe("danger")
    expect(storageStatus(2_500_000).percent).toBe(50)
  })
})
