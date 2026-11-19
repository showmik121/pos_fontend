"use client"

import { Button } from "./ui/button"
import { useInstall } from "./use-install"

/** "হোম স্ক্রিনে যোগ করুন" বার। ইনস্টল হয়ে থাকলে বা সম্প্রতি বাদ দিলে দেখায় না। */
export function InstallBanner() {
  const { mode, hidden, dismiss, install } = useInstall(true)

  if (hidden || mode === "installed" || mode === "other") return null

  const onInstall = async () => {
    if (!(await install())) dismiss()
  }

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
          <Button onClick={onInstall} className="min-h-11 flex-1">
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
