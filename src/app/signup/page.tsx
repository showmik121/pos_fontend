"use client"

import { Logo } from "@/components/logo"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { useAuth } from "@/components/auth-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { PasswordField } from "@/components/ui/password-field"
import { errorMessage } from "@/lib/api/client"
import { registerStore } from "@/lib/api/endpoints"
import type { StoreKind } from "@/lib/api/schemas"
import { cn } from "@/lib/cn"
import { normalizeBdPhone } from "@/lib/format/phone"

const KINDS: Array<{ value: StoreKind; label: string }> = [
  { value: "pharmacy", label: "ফার্মেসি" },
  { value: "cosmetics", label: "কসমেটিক্স" },
  { value: "other", label: "অন্যান্য" },
]

type Errors = Partial<Record<"storeName" | "ownerName" | "phone" | "password", string>>

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
    if (!storeName.trim()) next.storeName = "দোকানের নাম দিন"
    if (!ownerName.trim()) next.ownerName = "আপনার নাম দিন"
    if (!normalized) next.phone = "মোবাইল নম্বর সঠিক নয় (যেমন ০১৭১২৩৪৫৬৭৮)"
    if (password.length < 8) next.password = "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে"
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
    <main className="mx-auto min-h-dvh max-w-(--app-col) bg-white px-5 py-10">
      <div className="mb-8"><Logo /></div>
      <h1 className="text-2xl font-bold">দোকান খুলুন</h1>
      <p className="mt-1 text-sm text-muted">দোকানের তথ্য দিয়ে আপনার অ্যাকাউন্ট তৈরি করুন।</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <Field id="storeName" label="দোকানের নাম" autoComplete="organization" value={storeName} onChange={(e) => setStoreName(e.target.value)} error={errors.storeName} />

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">দোকানের ধরন</legend>
          <div role="radiogroup" aria-label="দোকানের ধরন" className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={storeKind === k.value}
                onClick={() => setStoreKind(k.value)}
                className={cn(
                  "min-h-12 rounded-xl border text-[15px] font-medium",
                  storeKind === k.value ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white text-ink",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field id="ownerName" label="আপনার নাম" autoComplete="name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} error={errors.ownerName} />
        <Field
          id="phone"
          label="মোবাইল নম্বর"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="০১৭১২৩৪৫৬৭৮"
          hint="এটাই আপনার লগইন আইডি"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
        />
        <PasswordField id="password" label="পাসওয়ার্ড" autoComplete="new-password" hint="কমপক্ষে ৮ অক্ষর" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />

        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button type="submit" full loading={busy}>
          দোকান খুলুন
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        আগেই অ্যাকাউন্ট আছে?{" "}
        <Link href="/login" className="font-medium text-brand">
          লগইন করুন
        </Link>
      </p>
    </main>
  )
}
