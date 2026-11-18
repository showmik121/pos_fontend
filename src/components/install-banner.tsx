"use client"

import { useEffect, useState } from "react"
import { Button } from "./ui/button"

/** Chrome/Edge/Android-এর ইনস্টল ইভেন্ট (সব ব্রাউজারে নেই, তাই টাইপ নিজে লেখা) */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pos.install.dismissed.v1"
/** "পরে" চাপলে এতদিন আর দেখাবে না */
const DISMISS_DAYS = 14
const DAY_MS = 86_400_000

type Mode = "hidden" | "prompt" | "ios"

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * DAY_MS
  } catch {
    return false
  }
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return ios && !otherBrowser
}

/** "হোম স্ক্রিনে যোগ করুন" বার। ইনস্টল হয়ে থাকলে বা সম্প্রতি বাদ দিলে দেখায় না। */
export function InstallBanner() {
  const [mode, setMode] = useState<Mode>("hidden")
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return
    if (isIosSafari()) setMode("ios")

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
      setMode("prompt")
    }
    const onInstalled = () => {
      setEvent(null)
      setMode("hidden")
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // সংরক্ষণ না হলেও বার এই সেশনে বন্ধ হবে
    }
    setMode("hidden")
  }

  const install = async () => {
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    setEvent(null)
    if (choice.outcome === "accepted") setMode("hidden")
    else dismiss()
  }

  if (mode === "hidden") return null
  return (
    <section aria-label="অ্যাপ ইনস্টল" className="no-print space-y-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
      <p className="font-medium">ফোনের হোম স্ক্রিনে অ্যাপ হিসেবে রাখুন</p>
      {mode === "ios" ? (
        <p>Safari-র নিচে শেয়ার (⬆) বোতাম চেপে &quot;Add to Home Screen&quot; বেছে নিন।</p>
      ) : (
        <p>ইনস্টল করলে অ্যাপের মতো সরাসরি খুলবে, ইন্টারনেট ছাড়াও চলবে।</p>
      )}
      <div className="flex gap-2">
        {mode === "prompt" ? (
          <Button onClick={install} className="min-h-11 flex-1">
            ইনস্টল করুন
          </Button>
        ) : null}
        <Button variant="secondary" onClick={dismiss} className="min-h-11 flex-1">
          পরে
        </Button>
      </div>
    </section>
  )
}
