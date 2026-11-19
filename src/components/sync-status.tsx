"use client"

import { toBanglaDigits } from "@/lib/format/bn"
import { useDb } from "./db-provider"
import { Banner } from "./ui/banner"

function timeText(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : toBanglaDigits(d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))
}

/** সেটিংসে: তথ্য সার্ভারে সিংক হচ্ছে কি না, বাকি কত */
export function SyncStatus() {
  const { syncInfo } = useDb()
  const { pending, dropped, lastSyncAt, status } = syncInfo
  const n = toBanglaDigits(String(pending))
  if (status === "auth")
    return <Banner tone="warn">সিংক থেমে আছে — লগআউট করে আবার লগইন করুন। {pending > 0 ? `${n}টি বদল পাঠানো বাকি; ডেটা ফোনে নিরাপদ আছে।` : ""}</Banner>
  if (pending > 0)
    return (
      <Banner tone="warn">
        {n}টি বদল সার্ভারে পাঠানো বাকি{status === "offline" ? " (ইন্টারনেট নেই; নেট এলে নিজে থেকেই যাবে)" : ""}। এর মধ্যেও ডেটা ফোনে সেভ আছে।
      </Banner>
    )
  return (
    <Banner tone="info">
      {lastSyncAt ? `সার্ভারে সিংক আছে (সর্বশেষ ${timeText(lastSyncAt)})।` : "সিংক শুরু হচ্ছে…"}
      {dropped > 0 ? ` ${toBanglaDigits(String(dropped))}টি বদল সার্ভার নেয়নি; ব্যাকআপ নিয়ে রাখুন।` : ""} তবু মাঝেমধ্যে ব্যাকআপ নেওয়া ভালো।
    </Banner>
  )
}
