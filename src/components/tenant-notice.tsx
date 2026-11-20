"use client"

import { tenantNotice, type TenantNotice } from "@/lib/account/notice"
import { tr } from "@/lib/i18n"
import { useAuth } from "./auth-provider"
import { useDb } from "./db-provider"

/** দোকানের অবস্থা (সাসপেন্ড/শুধু-দেখা) নিয়ে মালিককে কী জানাতে হবে; লগইন না থাকলে বা সব ঠিক থাকলে null */
export function useTenantNotice(): TenantNotice | null {
  const { state } = useAuth()
  const { syncInfo } = useDb()
  const store = state.status === "authed" ? state.store : null
  return tenantNotice({ storeStatus: store?.status, sync: syncInfo.status, message: store?.statusMessage })
}

/** শুধু-দেখা মোডে নতুন বিক্রি ও স্টক-জমা বন্ধ; দেখা, ব্যাকআপ ও রপ্তানি চলে */
export function useReadOnlyShop(): boolean {
  return useTenantNotice()?.kind === "read_only"
}

/** সব পর্দার ওপরে: ফোনের ডেটা যে নিরাপদ তা সবার আগে বলে */
export function TenantBanner() {
  const notice = useTenantNotice()
  if (!notice) return null
  const restricted = notice.kind === "read_only"
  return (
    <div role="alert" className="bg-warn-bg px-4 py-2 text-sm text-warn">
      <p className="font-semibold">
        {restricted
          ? tr("আপনার অ্যাকাউন্ট এখন শুধু দেখার মোডে আছে। নতুন বিক্রি বা স্টক এন্ট্রি আপাতত বন্ধ; ফোনে জমা থাকা কাজ নিরাপদে আছে।")
          : tr("আপনার অ্যাকাউন্ট সাময়িকভাবে বন্ধ আছে। সার্ভারে সিংক বন্ধ, কিন্তু ফোনের ডেটা সুরক্ষিত আছে।")}
      </p>
      {notice.message ? <p className="mt-1">{notice.message}</p> : null}
      <p className="mt-1">{tr("সাহায্যের জন্য আমাদের সাথে যোগাযোগ করুন।")}</p>
    </div>
  )
}
