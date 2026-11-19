"use client"

import { useEffect } from "react"
import { isNoise } from "@/lib/report/crash-report"
import { reportCrash } from "@/lib/report/send"

/** পাতার বাইরের (ইভেন্ট হ্যান্ডলার, প্রমিস) ত্রুটি ধরে নিজের সার্ভারে জানায়; রেন্ডার ত্রুটি যায় CrashScreen থেকে */
export function CrashReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isNoise(e.message, e.filename, window.location.origin)) return
      reportCrash("window", e.error ?? e.message)
    }
    const onRejection = (e: PromiseRejectionEvent) => reportCrash("rejection", e.reason)
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
  return null
}
