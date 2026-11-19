import { backupFileName, buildBackup } from "../store/backup"
import { markBackedUp } from "../store/backup-reminder"
import type { Db } from "../store/types"
import { downloadTextFile } from "./download"

/** ব্যাকআপ ফাইল নামায় এবং "আজ ব্যাকআপ নেওয়া হয়েছে" মনে রাখে */
export function downloadBackup(db: Db, storeId: string, now: Date = new Date()): void {
  downloadTextFile(backupFileName(now), buildBackup(db, storeId, now))
  markBackedUp(storeId, now)
}
