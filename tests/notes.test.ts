import { describe, expect, it } from "vitest"
import { createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { addNote, outOfStockSuggestions, pendingNoteCount, removeNote, setNoteDone, visibleNotes } from "../src/lib/store/notes"
import { applyEvents } from "../src/lib/sync/replay"
import { eventsFromChange } from "../src/lib/sync/diff"
import { newId } from "../src/lib/store/db"

const NOW = new Date("2026-11-20T10:00:00+06:00")
const TODAY = "2026-11-20"

describe("বিক্রেতার নোট", () => {
  it("যোগ, আনা হয়েছে, মোছা; ফাঁকা লেখা আটকায়", () => {
    let db = addNote(emptyDb(), { text: " পন্ডস ক্রিম ২টা ", kind: "request", customerName: "রহিম" }, NOW)
    expect(db.notes?.[0]).toMatchObject({ text: "পন্ডস ক্রিম ২টা", kind: "request", customerName: "রহিম", done: false })
    expect(() => addNote(db, { text: "  ", kind: "out" }, NOW)).toThrow()
    const id = db.notes![0]!.id
    expect(pendingNoteCount(db)).toBe(1)
    db = setNoteDone(db, id, true)
    expect(pendingNoteCount(db)).toBe(0)
    expect(visibleNotes(db)).toHaveLength(1)
    db = removeNote(db, id)
    expect(visibleNotes(db)).toHaveLength(0)
    expect(() => setNoteDone(db, "x", true)).toThrow()
  })
  it("কাস্টমারের নাম শুধু 'চেয়েছে' ধরনে থাকে; আনা হয়ে গেলে তালিকার নিচে যায়", () => {
    let db = addNote(emptyDb(), { text: "ক", kind: "out", customerName: "কেউ" }, NOW)
    expect(db.notes?.[0]?.customerName).toBe("")
    db = addNote(db, { text: "খ", kind: "other" }, new Date("2026-11-20T11:00:00+06:00"))
    db = setNoteDone(db, db.notes![1]!.id, true)
    expect(visibleNotes(db).map((n) => n.text)).toEqual(["ক", "খ"])
  })
  it("স্টক শেষ পণ্য সাজেশনে আসে, নোটে তোলা থাকলে আসে না", () => {
    const made = createProduct(emptyDb(), { name: "পন্ডস", unit: "piece", cartonSize: 1, costPoisha: 100, pricePoisha: 200, minStock: 1, category: "", barcode: null, open: false }, NOW)
    expect(outOfStockSuggestions(made.db, TODAY).map((p) => p.name)).toEqual(["পন্ডস"])
    const stocked = stockIn(made.db, { productId: made.product.id, qty: 3, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 100, pricePoisha: null, requireBatchAndExpiry: false }, NOW)
    expect(outOfStockSuggestions(stocked, TODAY)).toHaveLength(0)
    const noted = addNote(made.db, { text: "পন্ডস", kind: "out", productId: made.product.id }, NOW)
    expect(outOfStockSuggestions(noted, TODAY)).toHaveLength(0)
  })
  it("নোট সিংকে যায়, অন্য ডিভাইসে বসে, মোছাও পৌঁছায়", () => {
    const before = emptyDb()
    const after = addNote(before, { text: "লিপস্টিক", kind: "request", customerName: "করিম" }, NOW)
    const out = eventsFromChange(before, after, newId, NOW)
    expect(out.events.map((e) => e.kind)).toEqual(["note_upserted"])
    const other = applyEvents(emptyDb(), out.events).db
    expect(visibleNotes(other).map((n) => n.text)).toEqual(["লিপস্টিক"])
    const gone = removeNote(out.db, out.db.notes![0]!.id)
    const del = eventsFromChange(out.db, gone, newId, new Date("2026-11-20T12:00:00+06:00"))
    expect(visibleNotes(applyEvents(other, del.events).db)).toHaveLength(0)
  })
})
