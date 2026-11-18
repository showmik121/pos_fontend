"use client"

import { useState } from "react"
import { downloadTextFile } from "@/lib/browser/download"
import { rescueBackup } from "@/lib/store/rescue"

// স্টাইল ইনলাইন: global-error-এ layout ও globals.css থাকে না, তবু যেন পাতা পড়া যায়
const box = { minHeight: "100dvh", display: "grid", placeContent: "center", gap: 12, padding: 24, textAlign: "center", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, sans-serif" } as const
const btn = { padding: "12px 16px", borderRadius: 10, fontSize: 16, fontWeight: 600, border: "1px solid #0F766E" } as const

/** অ্যাপ ভেঙে গেলে দেখানো পাতা: আবার চেষ্টা, হোমে ফেরা, আর ডেটা নামানো */
export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const [note, setNote] = useState<string | null>(null)

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
      <button type="button" onClick={onRetry} style={{ ...btn, background: "#0F766E", color: "#fff" }}>
        আবার চেষ্টা করুন
      </button>
      <button type="button" onClick={saveData} style={{ ...btn, background: "#fff", color: "#0F766E" }}>
        ডেটার কপি নামান
      </button>
      <a href="/" style={{ color: "#0F766E", fontWeight: 600 }}>
        হোমে ফিরুন
      </a>
      {note ? <p style={{ margin: 0, color: "#0F766E" }}>{note}</p> : null}
    </div>
  )
}
