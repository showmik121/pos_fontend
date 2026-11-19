"use client"

import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { BackupSection } from "@/components/backup-section"
import { SyncStatus } from "@/components/sync-status"

/** ডেটা ও ব্যাকআপ: সিংকের অবস্থা, ব্যাকআপ নামানো/ফেরানো (সেটিংসে শুধু এক লাইনের অবস্থা দেখায়) */
export default function DataPage() {
  const { state } = useAuth()
  if (state.status !== "authed") return <AppShell title="ডেটা ও ব্যাকআপ" backHref="/settings">{null}</AppShell>
  return (
    <AppShell title="ডেটা ও ব্যাকআপ" backHref="/settings">
      <SyncStatus />
      <BackupSection storeId={state.store?.id ?? ""} />
    </AppShell>
  )
}
