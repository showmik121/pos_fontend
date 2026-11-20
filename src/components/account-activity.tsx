"use client"

import { useEffect, useState } from "react"
import { getAccountActivity } from "@/lib/api/endpoints"
import type { AccountActivity as Activity, StoreStatus } from "@/lib/api/schemas"
import { formatDateTimeBn } from "@/lib/format/datetime"
import { tr } from "@/lib/i18n"
import { useAuth } from "./auth-provider"

const LABEL: Record<StoreStatus, string> = {
  trial: "ট্রায়াল চালু",
  active: "অ্যাকাউন্ট চালু",
  grace: "বাড়তি সময়",
  read_only: "শুধু দেখার মোড",
  suspended: "অ্যাকাউন্ট সাময়িক বন্ধ",
  pending_deletion: "মুছে ফেলার অপেক্ষায়",
  deleted: "মুছে ফেলা হয়েছে",
  cancelled: "বাতিল",
}

/** সেটিংসে: প্ল্যাটফর্ম অপারেটর এই দোকানের অ্যাকাউন্টে কখন কী করেছে। খালি থাকলে কিছুই দেখায় না; ভেতরের কারণ সার্ভার পাঠায়ই না। */
export function AccountActivity() {
  const { state } = useAuth()
  const token = state.status === "authed" ? state.token : null
  const [items, setItems] = useState<Activity | null>(null)

  useEffect(() => {
    if (!token) return
    let live = true
    getAccountActivity(token).then(
      (a) => {
        if (live) setItems(a)
      },
      () => {
        // অফলাইন বা পুরনো সার্ভার: তালিকা না দেখানোই ঠিক, কোনো ভুল বার্তা নয়
        if (live) setItems(null)
      },
    )
    return () => {
      live = false
    }
  }, [token])

  if (!items || items.length === 0) return null
  return (
    <section className="space-y-2" aria-labelledby="account-activity-h">
      <h2 id="account-activity-h" className="px-1 text-[15px] font-semibold">
        {tr("অ্যাকাউন্টের ইতিহাস")}
      </h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {items.map((a) => (
          <li key={`${a.at}-${a.status}`} className="px-4 py-3 text-sm">
            <div className="font-medium">{tr(LABEL[a.status])}</div>
            <div className="text-[13px] text-muted">{formatDateTimeBn(a.at)}</div>
            {a.message ? <div className="mt-1">{a.message}</div> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
