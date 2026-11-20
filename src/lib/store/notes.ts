import { DomainError } from "../domain/errors"
import { newId } from "./db"
import { sellableStock } from "./selectors"
import type { Db, Note, Product } from "./types"

export const NOTE_TEXT_MAX = 120
export const NOTE_KIND_LABEL: Record<Note["kind"], string> = { out: "স্টক শেষ", request: "কাস্টমার চেয়েছে", other: "অন্যান্য" }

/** নতুন নোট; লেখা ফাঁকা হলে ত্রুটি */
export function addNote(db: Db, input: { text: string; kind: Note["kind"]; customerName?: string; productId?: string }, now: Date): Db {
  const text = input.text.trim().slice(0, NOTE_TEXT_MAX)
  if (!text) throw new DomainError("note_required", "কী আনতে হবে লিখুন")
  const note: Note = {
    id: newId(),
    text,
    kind: input.kind,
    customerName: input.kind === "request" ? (input.customerName ?? "").trim().slice(0, 60) : "",
    ...(input.productId ? { productId: input.productId } : {}),
    done: false,
    createdAt: now.toISOString(),
  }
  return { ...db, notes: [...(db.notes ?? []), note] }
}

function patchNote(db: Db, id: string, patch: Partial<Note>): Db {
  const notes = db.notes ?? []
  if (!notes.some((n) => n.id === id)) throw new DomainError("note_not_found", "নোট পাওয়া যায়নি")
  return { ...db, notes: notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }
}

/** আনা হয়েছে / আবার বাকি */
export const setNoteDone = (db: Db, id: string, done: boolean): Db => patchNote(db, id, { done })

export const removeNote = (db: Db, id: string): Db => patchNote(db, id, { deleted: true })

/** মোছা বাদে; আনতে বাকি আগে (নতুন আগে), আনা হয়ে গেলে নিচে */
export function visibleNotes(db: Db): Note[] {
  return (db.notes ?? [])
    .filter((n) => !n.deleted)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

export function pendingNoteCount(db: Db): number {
  return (db.notes ?? []).filter((n) => !n.deleted && !n.done).length
}

/** স্টক শেষ (বিক্রির যোগ্য ০) অথচ নোটে এখনো ওঠেনি এমন পণ্য */
export function outOfStockSuggestions(db: Db, today: string): Product[] {
  const noted = new Set((db.notes ?? []).filter((n) => !n.deleted && !n.done && n.productId).map((n) => n.productId))
  return db.products.filter((p) => sellableStock(db, p.id, today) <= 0 && !noted.has(p.id))
}
