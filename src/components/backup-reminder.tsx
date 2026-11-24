"use client"

import { useEffect, useState } from "react"
import { loadReminderState, shouldRemindBackup } from "@/lib/store/backup-reminder"
import { useAuth } from "./auth-provider"
import { useDb } from "./db-provider"

/** আজ ব্যাকআপ নেওয়ার কথা কি না। হোমে ব্যানার নয়; হেডারের সেটিংস-আইকনে ছোট বিন্দু দেখাতে ব্যবহার হয় (ব্যাকআপ নেওয়া হয় সেটিংস › ডেটা ও ব্যাকআপে)। */
export function useBackupDue(): boolean {
  const { state } = useAuth()
  const { db, ready } = useDb()
  const storeId = state.status === "authed" && state.store ? state.store.id : null
  const [due, setDue] = useState(false)

  useEffect(() => {
    if (!storeId || !ready) {
      setDue(false)
      return
    }
    setDue(shouldRemindBackup(db, loadReminderState(storeId), new Date()))
  }, [storeId, ready, db])

  return due
}
