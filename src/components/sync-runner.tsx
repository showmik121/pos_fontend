"use client"

import { useCallback, useEffect, useRef } from "react"
import { pullEvents, pushEvents, registerDevice } from "@/lib/api/endpoints"
import { loadDevice, saveDeviceCode } from "@/lib/store/device"
import { reportCrash } from "@/lib/report/send"
import { runSyncCycle } from "@/lib/sync/cycle"
import { useAuth } from "./auth-provider"
import { useDb } from "./db-provider"

const INTERVAL_MS = 60_000
const AFTER_CHANGE_MS = 3_000

/** লগইন থাকলে পেছনে সিংক চালায়: খোলার সময়, প্রতি মিনিটে, নেট ফিরলে, অ্যাপে ফিরলে এবং স্থানীয় বদলের কয়েক সেকেন্ড পরে। অফলাইনে চুপচাপ থাকে। */
export function SyncRunner() {
  const { state } = useAuth()
  const { ready, syncNow, syncInfo, noteSyncStatus } = useDb()
  const storeId = state.status === "authed" && state.store ? state.store.id : null
  const token = state.status === "authed" ? state.token : null
  const syncRef = useRef(syncNow)
  syncRef.current = syncNow
  const noteRef = useRef(noteSyncStatus)
  noteRef.current = noteSyncStatus

  // runSyncCycle কখনো ছোঁড়ে না (আগে `void run()`-এ ছুঁড়লে unhandled rejection হতো) এবং ব্যর্থতার কারণ পর্দায় জানায
  const run = useCallback(async () => {
    if (!storeId || !token) return
    await runSyncCycle({
      device: () => loadDevice(storeId),
      saveDeviceCode: (code) => saveDeviceCode(storeId, code),
      registerDevice: (deviceId) => registerDevice(token, deviceId),
      pushEvents: async (deviceId, events) => {
        await pushEvents(token, deviceId, events)
      },
      pullEvents: (after, limit) => pullEvents(token, after, limit),
      syncNow: (transport) => syncRef.current(transport),
      note: (status) => noteRef.current(status),
      report: (err) => reportCrash("rejection", err),
    })
  }, [storeId, token])

  useEffect(() => {
    if (!ready || !storeId || !token) return
    void run()
    const timer = setInterval(() => void run(), INTERVAL_MS)
    const onOnline = () => void run()
    const onVisible = () => {
      if (document.visibilityState === "visible") void run()
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [ready, storeId, token, run])

  // স্থানীয় বদল জমলে একটু পরে পাঠানো
  useEffect(() => {
    if (!ready || !storeId || !token || syncInfo.pending === 0) return
    const t = setTimeout(() => void run(), AFTER_CHANGE_MS)
    return () => clearTimeout(t)
  }, [ready, storeId, token, syncInfo.pending, run])

  return null
}
