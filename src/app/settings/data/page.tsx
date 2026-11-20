"use client"

import { tr } from "@/lib/i18n"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { BackupSection } from "@/components/backup-section"
import { ReportDownloads } from "@/components/report-downloads"
import { SyncStatus } from "@/components/sync-status"
import { SectionTitle } from "@/components/ui/card"

/** ডেটা ও ব্যাকআপ: নিজের হিসাব Excel-এ নামানো; নিচে "উন্নত" অংশে ব্যাকআপ ফাইল (ফোন বদলানো/ডেটা ফেরানোর জন্য) */
export default function DataPage() {
  const { state } = useAuth()
  if (state.status !== "authed") return <AppShell title={tr("ডেটা ও ব্যাকআপ")} backHref="/settings">{null}</AppShell>
  return (
    <AppShell title={tr("ডেটা ও ব্যাকআপ")} backHref="/settings">
      <SyncStatus />
      <SectionTitle>{tr("আপনার হিসাব Excel-এ নামান")}</SectionTitle>
      <ReportDownloads />
      <SectionTitle>{tr("উন্নত: পুরো ডেটার ব্যাকআপ")}</SectionTitle>
      <p className="px-1 text-sm text-muted">{tr("এটি শুধু অ্যাপের নিজের ব্যাকআপ ফাইল (Excel-এ পড়া যায় না)। ফোন বদলালে বা ডেটা ফেরাতে লাগে।")}</p>
      <BackupSection storeId={state.store?.id ?? ""} />
    </AppShell>
  )
}
