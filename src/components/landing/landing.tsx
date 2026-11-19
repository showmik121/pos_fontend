"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Logo } from "@/components/logo"
import { Icon } from "@/components/ui/icons"
import { LinkButton } from "@/components/ui/button"
import { FEATURES, HERO, STEPS, TRUST_POINTS } from "./landing-content"
import { PhonePreview } from "./phone-preview"

/** হোম-স্ক্রিন থেকে খোলা (ইনস্টল করা) অ্যাপে ল্যান্ডিং দেখানোর দরকার নেই, সরাসরি লগইনে যাবে */
function isInstalledApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

export function Landing() {
  const router = useRouter()

  useEffect(() => {
    if (isInstalledApp()) router.replace("/login")
  }, [router])

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Logo size={44} />
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold text-brand-dark active:bg-brand-soft">
          লগইন
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-12 pt-6 md:grid-cols-2 md:pb-20 md:pt-12">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3 py-1 text-[13px] font-semibold text-warn">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
            {HERO.eyebrow}
          </span>
          <h1 className="mt-4 text-[34px] font-extrabold leading-[1.2] tracking-tight text-ink md:text-5xl md:leading-[1.15]">
            দোকানের হিসাব, <span className="text-brand">এখন ফোনেই</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink2 md:text-lg">{HERO.lead}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/signup" className="min-h-14 px-7 text-base">
              দোকান খুলুন
              <Icon name="chevron" size={18} />
            </LinkButton>
            <LinkButton href="/login" variant="secondary" className="min-h-14 px-7 text-base">
              লগইন
            </LinkButton>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-medium text-ink2">
            {TRUST_POINTS.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Icon name="check" size={16} className="text-brand" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <PhonePreview />
      </section>

      <section className="border-y border-line bg-white" aria-labelledby="features-title">
        <div className="mx-auto max-w-5xl px-5 py-12 md:py-16">
          <h2 id="features-title" className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            দোকান চালাতে যা যা লাগে
          </h2>
          <p className="mt-2 max-w-lg text-ink2">ফার্মেসি আর কসমেটিক্স দোকানের রোজকার কাজ ধরে বানানো।</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="card-surface rounded-2xl border border-line bg-canvas p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-brand text-white shadow-sm">
                  <Icon name={f.icon} size={22} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink2">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12 md:py-16" aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
          তিন ধাপেই শুরু
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-line bg-white p-5">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-gold text-[15px] font-extrabold text-ink">
                {["১", "২", "৩"][i]}
              </span>
              <h3 className="mt-3 text-[17px] font-bold text-ink">{s.title}</h3>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-5 pb-10">
        <div className="hero-card mx-auto max-w-5xl rounded-3xl px-6 py-9 text-center md:py-12">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">আজই আপনার দোকানের খাতা ফোনে তুলুন</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink/75">নাম আর মোবাইল নম্বর দিলেই দোকান তৈরি।</p>
          <LinkButton href="/signup" className="mx-auto mt-6 min-h-14 px-8 text-base">
            দোকান খুলুন
          </LinkButton>
        </div>
      </section>

      <div className="app-skyline mx-auto max-w-5xl opacity-90" aria-hidden="true" />
      <footer className="bg-white py-6 text-center text-[13px] text-muted">
        <p>© বিপণি — ফার্মেসি ও কসমেটিক্স দোকানের জন্য</p>
      </footer>
    </div>
  )
}
