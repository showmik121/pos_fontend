"use client"

import { useEffect, useState } from "react"
import { downloadTextFile } from "@/lib/browser/download"
import { reportCrash } from "@/lib/report/send"
import { rescueBackup } from "@/lib/store/rescue"

// স্টাইল ইনলাইন: global-error-এ layout ও globals.css থাকে না, তবু যেন পাতা পড়া যায়
const box = { minHeight: "100dvh", display: "grid", placeContent: "center", gap: 12, padding: 24, textAlign: "center", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, sans-serif" } as const
const btn = { padding: "12px 16px", borderRadius: 10, fontSize: 16, fontWeight: 600, border: "1px solid #2E6B3A" } as const

/** অ্যাপ ভেঙে গেলে দেখানো পাতা: আবার চেষ্টা, হোমে ফেরা, আর ডেটা নামানো */
export function CrashScreen({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (error !== undefined) reportCrash("render", error)
  }, [error])

  const saveData = () => {
    try {
      const file = rescueBackup(window.localStorage, new Date())
      if (!file) {
        setNote("এই ফোনে সেভ করা কোনো ডেটা পাওয়া যায়নি।")
        return
      }
      downloadTextFile(file.fileName, file.text)
      setNote("ডেটার কপি নামানো হয়েছে। ফাইলটি নিরাপদ জায়গায় রাখুন।")
    } catch {
      setNote("ডেটা নামানো যায়নি। ফোনের জায়গা বা ব্রাউজারের অনুমতি দেখুন।")
    }
  }

  return (
    <div role="alert" style={box}>
      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>কিছু একটা গোলমাল হয়েছে</p>
      <p style={{ margin: 0, color: "#475569" }}>আপনার ডেটা ফোনে ঠিকই আছে। আবার চেষ্টা করুন। না হলে আগে ডেটার কপি নামিয়ে রাখুন, তারপর অ্যাপ বন্ধ করে আবার খুলুন।</p>
      <button type="button" onClick={onRetry} style={{ ...btn, background: "#2E6B3A", color: "#fff" }}>
        আবার চেষ্টা করুন
      </button>
      <button type="button" onClick={saveData} style={{ ...btn, background: "#fff", color: "#2E6B3A" }}>
        ডেটার কপি নামান
      </button>
      {/* ইচ্ছাকৃত সাধারণ লিংক: অ্যাপের গাছ ভাঙা, তাই ক্লায়েন্ট-নেভিগেশন নয়, পুরো পাতা নতুন করে লোড হওয়া দরকার */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" style={{ color: "#2E6B3A", fontWeight: 600 }}>
        হোমে ফিরুন
      </a>
      {note ? <p style={{ margin: 0, color: "#2E6B3A" }}>{note}</p> : null}
    </div>
  )
}
