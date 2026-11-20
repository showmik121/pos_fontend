import { tr } from "../i18n"
import { DomainError } from "../domain/errors"
import { localDateIso } from "../domain/dates"
import { isDb } from "./db"
import type { Db } from "./types"

const APP = "pos-backup"
const VERSION = 1

/** ব্যাকআপ ফাইলের সর্বোচ্চ আকার (অক্ষর); এর বেশি হলে ভুল ফাইল ধরে নেওয়া হয় */
export const BACKUP_MAX_BYTES = 20_000_000

/** ব্রাউজারের localStorage সাধারণত ~৫ মিলিয়ন অক্ষর ধরে; এটি আনুমানিক সীমা */
export const STORAGE_LIMIT_CHARS = 5_000_000
const WARN_AT = 0.5
const DANGER_AT = 0.8

export function backupFileName(now: Date): string {
  return `pos-backup-${localDateIso(now)}.json`
}

export function buildBackup(db: Db, storeId: string, now: Date): string {
  return JSON.stringify({ app: APP, version: VERSION, storeId, exportedAt: now.toISOString(), db })
}

export interface ParsedBackup {
  db: Db
  exportedAt: string
}

/** ব্যাকআপ ফাইল যাচাই করে Db ফেরত দেয়; ভুল হলে বাংলা বার্তাসহ DomainError */
export function parseBackup(text: string, storeId: string): ParsedBackup {
  if (text.length > BACKUP_MAX_BYTES) throw new DomainError("backup_too_large", tr("ফাইলটি অনেক বড়; এটি ব্যাকআপ ফাইল নয় মনে হচ্ছে"))
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new DomainError("backup_invalid", tr("ফাইলটি পড়া যায়নি; অ্যাপ থেকে নামানো ব্যাকআপ ফাইল দিন"))
  }
  if (typeof data !== "object" || data === null) throw new DomainError("backup_invalid", tr("এটি এই অ্যাপের ব্যাকআপ ফাইল নয়"))
  const b = data as Record<string, unknown>
  if (b.app !== APP || b.version !== VERSION || typeof b.exportedAt !== "string" || typeof b.storeId !== "string") {
    throw new DomainError("backup_invalid", tr("এটি এই অ্যাপের ব্যাকআপ ফাইল নয়"))
  }
  if (b.storeId !== storeId) throw new DomainError("backup_other_store", tr("এই ব্যাকআপ অন্য দোকানের; এখানে ফেরানো যাবে না"))
  if (!isDb(b.db)) throw new DomainError("backup_invalid", tr("ব্যাকআপের ভেতরের তথ্য নষ্ট বা অচেনা"))
  return { db: b.db, exportedAt: b.exportedAt }
}

export type StorageLevel = "ok" | "warn" | "danger"

export function storageStatus(chars: number): { percent: number; level: StorageLevel } {
  const ratio = chars / STORAGE_LIMIT_CHARS
  const level: StorageLevel = ratio >= DANGER_AT ? "danger" : ratio >= WARN_AT ? "warn" : "ok"
  return { percent: Math.min(100, Math.round(ratio * 100)), level }
}

/**
 * ব্যাকআপ ফেরানোর ফল। বিল-কাউন্টার কখনো পিছোয় না: ব্যাকআপের পরে এই ফোনে যে নম্বরগুলো দেওয়া হয়ে গেছে,
 * সেগুলো ফের দিলে একই বিল নম্বর দুটি বিলে পড়ত।
 */
export function restoredDb(current: Db, backup: Db): Db {
  return { ...backup, billCounter: Math.max(current.billCounter, backup.billCounter) }
}
