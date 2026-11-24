"use client"

import { useEffect, useState } from "react"
import { loadReminderState, shouldRemindBackup } from "@/lib/store/backup-reminder"
import { useAuth } from "./auth-provider"
import { useDb } from "./db-provider"

/** আজ ব্যাকআপ নেওয়ার কথা কি না। সিংক ঠিক থাকলে কখনো নয়। হোমে ব্যানার নয়; হেডারের সেটিংস-আইকনে ছোট বিন্দু দেখাতে ব্যবহার হয় (ব্যাকআপ নেওয়া হয় সেটিংস › ডেটা ও ব্যাকআপে)। */
export function useBackupDue(): boolean {
  const { state } = useAuth()
  const { db, ready, syncInfo, syncSaveFailed } = useDb()
  const storeId = state.status === "authed" && state.store ? state.store.id : null
  const [due, setDue] = useState(false)

  useEffect(() => {
    if (!storeId || !ready) {
      setDue(false)
      return
    }
    setDue(shouldRemindBackup(db, loadReminderState(storeId), new Date()))
  }, [storeId, ready, db])

  // সিংক ঠিক চললে ডেটা সার্ভারে সুরক্ষিত; তখন ব্যাকআপের তাগিদ নেই। শুধু সিংক আটকে থাকলে (লগইন/ডিভাইস সীমা/ত্রুটি, ২৪ ঘণ্টা+ জমে থাকা, সার্ভারের ফেরত) বা সিংকের লাইন সেভ না হলে বিন্দু দেখায়।
  const syncBlocked =
    syncInfo.status === "auth" ||
    syncInfo.status === "device_limit" ||
    syncInfo.status === "error" ||
    syncInfo.stuck > 0 ||
    syncInfo.rejected > 0 ||
    syncSaveFailed
  return due && syncBlocked
}
