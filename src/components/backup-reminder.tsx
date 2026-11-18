"use client"

import { useEffect, useState } from "react"
import { downloadTextFile } from "@/lib/browser/download"
import { backupFileName, buildBackup } from "@/lib/store/backup"
import { loadReminderState, markBackedUp, shouldRemindBackup, snoozeToday } from "@/lib/store/backup-reminder"
import { useAuth } from "./auth-provider"
import { useDb } from "./db-provider"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"

/** দিনে একবার (কিছু বদলালে) ব্যাকআপ নিতে মনে করায়। এক ট্যাপে ফাইল নামে। */
export function BackupReminder() {
  const { state } = useAuth()
  const { db, ready } = useDb()
  const storeId = state.status === "authed" && state.store ? state.store.id : null
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!storeId || !ready) {
      setShow(false)
      return
    }
    setShow(shouldRemindBackup(db, loadReminderState(storeId), new Date()))
  }, [storeId, ready, db])

  if (!show || !storeId) return null

  const backupNow = () => {
    const now = new Date()
    downloadTextFile(backupFileName(now), buildBackup(db, storeId, now))
    markBackedUp(storeId, now)
    setShow(false)
  }
  const later = () => {
    snoozeToday(storeId, new Date())
    setShow(false)
  }

  return (
    <Banner tone="warn">
      <p className="font-medium">আজকের ব্যাকআপ নেওয়া হয়নি। ফোন হারালে বা মুছে গেলে হিসাব ফেরত পাওয়া যাবে না।</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={backupNow}>এখনই ব্যাকআপ নিন</Button>
        <Button variant="secondary" onClick={later}>
          পরে
        </Button>
      </div>
    </Banner>
  )
}
