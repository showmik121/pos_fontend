"use client"

import { useCallback, useEffect, useState } from "react"
import {
  DISMISS_KEY,
  clearInstallEvent,
  getInstallEvent,
  isDismissedRecently,
  isIosSafari,
  isStandalone,
  subscribeInstall,
} from "@/lib/pwa/install"

/** prompt = ব্রাউজারের নিজস্ব ইনস্টল ডায়ালগ খোলা যাবে, ios = হাতে "Add to Home Screen", other = ইনস্টল-বোতাম নেই */
export type InstallMode = "installed" | "prompt" | "ios" | "other"

function readDismissed(): boolean {
  try {
    return isDismissedRecently(localStorage.getItem(DISMISS_KEY), Date.now())
  } catch {
    return false
  }
}

/**
 * ইনস্টলের অবস্থা। `respectDismiss` সত্য হলে "পরে" চাপা ইউজারকে ১৪ দিন কিছু দেখায় না (ভিতরের বার);
 * ল্যান্ডিং পাতা এটা মানে না, কারণ সেখানে ইনস্টল একটা স্থায়ী বোতাম।
 */
export function useInstall(respectDismiss: boolean) {
  const [mode, setMode] = useState<InstallMode>("other")
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const sync = () => {
      if (isStandalone()) setMode("installed")
      else if (getInstallEvent()) setMode("prompt")
      else if (isIosSafari(navigator.userAgent, navigator.maxTouchPoints)) setMode("ios")
      else setMode("other")
    }
    sync()
    setHidden(respectDismiss && readDismissed())
    return subscribeInstall(sync)
  }, [respectDismiss])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // সংরক্ষণ না হলেও বার এই সেশনে বন্ধ হবে
    }
    setHidden(true)
  }, [])

  /** ব্রাউজারের ইনস্টল ডায়ালগ খোলে; ইউজার রাজি হলে true */
  const install = useCallback(async (): Promise<boolean> => {
    const event = getInstallEvent()
    if (!event) return false
    await event.prompt()
    const choice = await event.userChoice
    clearInstallEvent()
    return choice.outcome === "accepted"
  }, [])

  return { mode, hidden, dismiss, install }
}
