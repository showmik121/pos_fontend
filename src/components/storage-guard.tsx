"use client"

import { useEffect } from "react"
import { requestPersistentStorage } from "@/lib/browser/persist"
import { useAuth } from "./auth-provider"

/** লগইনের পর একবার ব্রাউজারকে ডেটা স্থায়ী রাখতে বলে (ফলাফল সেটিংসে দেখা যায়) */
export function StorageGuard() {
  const { state } = useAuth()
  const authed = state.status === "authed"
  useEffect(() => {
    if (authed) void requestPersistentStorage()
  }, [authed])
  return null
}
