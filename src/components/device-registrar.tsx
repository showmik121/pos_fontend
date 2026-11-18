"use client"

import { useEffect } from "react"
import { registerDevice } from "@/lib/api/endpoints"
import { loadDevice, saveDeviceCode } from "@/lib/store/device"
import { useAuth } from "./auth-provider"

const inFlight = new Set<string>()

/** লগইন থাকলে এই ফোনের ডিভাইস কোড (A–Z) একবার সার্ভার থেকে নেয়। অফলাইনে চুপচাপ ছেড়ে দেয়, পরের খোলায় আবার চেষ্টা। */
export function DeviceRegistrar() {
  const { state } = useAuth()
  const storeId = state.status === "authed" && state.store ? state.store.id : null
  const token = state.status === "authed" ? state.token : null

  useEffect(() => {
    if (!storeId || !token) return
    const device = loadDevice(storeId)
    if (device.code || inFlight.has(storeId)) return
    inFlight.add(storeId)
    registerDevice(token, device.id)
      .then((code) => saveDeviceCode(storeId, code))
      .catch(() => {
        // নেটওয়ার্ক/সার্ভার সমস্যা: বিল নম্বর উপসর্গ ছাড়াই চলবে, পরে আবার চেষ্টা
      })
      .finally(() => inFlight.delete(storeId))
  }, [storeId, token])

  return null
}
