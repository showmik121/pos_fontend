"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icons"
import { useInstall } from "@/components/use-install"
import { INSTALL_GUIDES } from "./landing-content"

/** ব্রাউজারের নিজস্ব ইনস্টল ডায়ালগ খোলার বোতাম; ব্রাউজার না দিলে কিছু দেখায় না */
export function InstallButton({ className, variant = "primary" }: { className?: string; variant?: "primary" | "secondary" }) {
  const { mode, install } = useInstall(false)
  const [busy, setBusy] = useState(false)
  if (mode !== "prompt") return null
  const onClick = async () => {
    setBusy(true)
    try {
      await install()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant={variant} onClick={onClick} loading={busy} className={className}>
      <Icon name="download" size={18} />
      অ্যাপ ইনস্টল করুন
    </Button>
  )
}

export function InstallSection() {
  const { mode } = useInstall(false)
  return (
    <section className="mx-auto max-w-5xl px-5 pb-12 md:pb-16" aria-labelledby="install-title">
      <div className="card-surface overflow-hidden rounded-3xl border border-line bg-white">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.4fr] md:p-8">
          <div>
            <h2 id="install-title" className="text-2xl font-extrabold tracking-tight text-ink">
              অ্যাপ স্টোর ছাড়াই, ব্রাউজার থেকে ইনস্টল
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink2">ইনস্টল করলে হোম স্ক্রিন থেকে অ্যাপের মতো সরাসরি খুলবে, ইন্টারনেট না থাকলেও চলবে।</p>
            <InstallButton className="mt-5 min-h-14 w-full px-6 text-base sm:w-auto" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {INSTALL_GUIDES.map((g) => {
              const highlighted = mode === "ios" ? g.platform.startsWith("আইফোন") : false
              return (
                <div key={g.platform} className={`rounded-2xl border p-4 ${highlighted ? "border-brand bg-brand-soft" : "border-line bg-canvas"}`}>
                  <h3 className="text-[15px] font-bold text-ink">{g.platform}</h3>
                  <ol className="mt-2 space-y-2">
                    {g.steps.map((step, i) => (
                      <li key={step} className="flex gap-2.5 text-[14px] leading-snug text-ink2">
                        <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-extrabold text-ink">
                          {["১", "২", "৩"][i]}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
