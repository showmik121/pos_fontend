"use client"

import { useEffect, type ReactNode } from "react"
import { AuthProvider } from "./auth-provider"
import { DbProvider } from "./db-provider"
import { DeviceRegistrar } from "./device-registrar"
import { StorageGuard } from "./storage-guard"
import { SyncRunner } from "./sync-runner"

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // service worker শুধু প্রোডাকশনে; ডেভে পুরনো ক্যাশ ঝামেলা করে
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // অফলাইন সুবিধা ছাড়াই অ্যাপ চলবে
      })
    }
  }, [])
  return (
    <AuthProvider>
      <DbProvider>
        <DeviceRegistrar />
        <StorageGuard />
        <SyncRunner />
        {children}
      </DbProvider>
    </AuthProvider>
  )
}
