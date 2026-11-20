"use client"

import { tr } from "@/lib/i18n"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useAuth } from "@/components/auth-provider"
import { Logo } from "@/components/logo"
import { BagIcon, LockIcon, PersonIcon, PhoneIcon, PillIcon, StoreIcon } from "@/components/signup-icons"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { PasswordField } from "@/components/ui/password-field"
import { errorMessage } from "@/lib/api/client"
import { registerStore } from "@/lib/api/endpoints"
import type { StoreKind } from "@/lib/api/schemas"
import { cn } from "@/lib/cn"
import { normalizeBdPhone } from "@/lib/format/phone"

// নতুন দোকানে দুটি বিকল্প। "রিটেইল" সংরক্ষিত হয় `other` হিসেবে; পুরনো `cosmetics` দোকানও সেটিংসে "রিটেইল" দেখায়।
const KINDS: Array<{ value: StoreKind; label: string; hint: string; icon: ReactNode }> = [
  { value: "pharmacy", label: "ফার্মেসি", hint: "ওষুধ — ব্যাচ ও মেয়াদের হিসাবসহ", icon: <PillIcon /> },
  { value: "other", label: "রিটেইল", hint: "কসমেটিক্স, কাপড়, মুদি ইত্যাদি", icon: <BagIcon /> },
]

type Errors = Partial<Record<"storeName" | "ownerName" | "phone" | "password", string>>

/** ক্রমিক সংখ্যাসহ ফর্মের একটি ধাপ */
function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-gold text-[15px] font-extrabold text-ink">
          {n}
        </span>
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
      {children}
    </section>
  )
}

export default function SignupPage() {
  const { state, signIn } = useAuth()
  const router = useRouter()
  const [storeName, setStoreName] = useState("")
  const [storeKind, setStoreKind] = useState<StoreKind>("pharmacy")
  const [ownerName, setOwnerName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (state.status === "authed") router.replace("/")
  }, [state.status, router])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const normalized = normalizeBdPhone(phone)
    const next: Errors = {}
    if (!storeName.trim()) next.storeName = tr("দোকানের নাম দিন")
    if (!ownerName.trim()) next.ownerName = tr("আপনার নাম দিন")
    if (!normalized) next.phone = tr("মোবাইল নম্বর সঠিক নয় (যেমন ০১৭১২৩৪৫৬৭৮)")
    if (password.length < 8) next.password = tr("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে")
    setErrors(next)
    if (Object.keys(next).length > 0 || !normalized) return

    setBusy(true)
    try {
      const res = await registerStore({ storeName: storeName.trim(), storeKind, ownerName: ownerName.trim(), phone: normalized, password })
      signIn({ token: res.token, user: res.user, store: null })
      router.replace("/")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-canvas">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-gold to-canvas" />
      <div className="relative mx-auto w-full max-w-md flex-1 px-5 pb-6 pt-6">
        <Link href="/login" className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/70 px-3.5 text-sm font-medium text-ink2 active:bg-white">
          <span aria-hidden="true">←</span> {tr("লগইনে ফিরুন")}
        </Link>
        <Logo size={44} />
        <h1 className="mt-5 text-[26px] font-extrabold leading-tight tracking-tight text-ink">{tr("আপনার দোকান খুলুন")}</h1>
        <p className="mt-1 text-[15px] text-ink2">{tr("মিনিটখানেকেই তৈরি — নাম, ধরন আর আপনার মোবাইল নম্বর হলেই চলবে।")}</p>

        <form onSubmit={onSubmit} noValidate className="card-surface mt-5 space-y-7 rounded-3xl border border-line bg-white p-5">
          <Step n={tr("১")} title={tr("দোকানের তথ্য")}>
            <Field id="storeName" label={tr("দোকানের নাম")} leading={<StoreIcon />} autoComplete="organization" hint={tr("রসিদে ও অ্যাপে এই নাম দেখাবে")} value={storeName} onChange={(e) => setStoreName(e.target.value)} error={errors.storeName} />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{tr("দোকানের ধরন")}</legend>
              <div role="radiogroup" aria-label={tr("দোকানের ধরন")} className="grid grid-cols-2 gap-3">
                {KINDS.map((k) => {
                  const on = storeKind === k.value
                  return (
                    <button
                      key={k.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={tr(k.label)}
                      onClick={() => setStoreKind(k.value)}
                      className={cn("flex min-h-[132px] flex-col items-start gap-2 rounded-2xl border-[1.5px] p-3.5 text-left transition-colors", on ? "border-brand bg-brand-soft" : "border-line bg-white active:bg-canvas")}
                    >
                      <span className={cn("grid size-11 place-items-center rounded-xl", on ? "bg-brand text-white" : "bg-chip text-brand-dark")}>{k.icon}</span>
                      <span className="text-[16px] font-bold text-ink">{tr(k.label)}</span>
                      <span className="text-[13px] leading-snug text-muted">{tr(k.hint)}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </Step>

          <Step n={tr("২")} title={tr("আপনার তথ্য")}>
            <Field id="ownerName" label={tr("আপনার নাম")} leading={<PersonIcon />} autoComplete="name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} error={errors.ownerName} />
            <Field
              id="phone"
              label={tr("মোবাইল নম্বর")}
              leading={<PhoneIcon />}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={tr("০১৭১২৩৪৫৬৭৮")}
              hint={tr("এটাই আপনার লগইন আইডি")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
            />
            <PasswordField id="password" label={tr("পাসওয়ার্ড")} leading={<LockIcon />} autoComplete="new-password" hint={tr("কমপক্ষে ৮ অক্ষর")} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
          </Step>

          {error ? <Banner tone="danger">{error}</Banner> : null}
          <div className="space-y-2.5">
            <Button type="submit" full loading={busy} className="min-h-14 text-base">
              {tr("দোকান খুলুন")}
            </Button>
            <p className="text-center text-[13px] text-muted">{tr("সব ঘর পূরণ করা লাগবে। দোকানের নাম পরে সেটিংসে বদলানো যাবে।")}</p>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {tr("আগেই অ্যাকাউন্ট আছে?")}{" "}
          <Link href="/login" className="font-semibold text-brand">
            {tr("লগইন করুন")}
          </Link>
        </p>
      </div>
      <div className="app-skyline relative mx-auto max-w-md opacity-90" aria-hidden="true" />
    </main>
  )
}
