"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { useAuth } from "@/components/auth-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { PasswordField } from "@/components/ui/password-field"
import { errorMessage } from "@/lib/api/client"
import { login } from "@/lib/api/endpoints"
import { normalizeBdPhone } from "@/lib/format/phone"

export default function LoginPage() {
  const { state, signIn } = useAuth()
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (state.status === "authed") router.replace("/")
  }, [state.status, router])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const normalized = normalizeBdPhone(phone)
    if (!normalized) {
      setPhoneError("মোবাইল নম্বর সঠিক নয় (যেমন ০১৭১২৩৪৫৬৭৮)")
      return
    }
    setPhoneError(null)
    if (!password) {
      setError("পাসওয়ার্ড দিন")
      return
    }
    setBusy(true)
    try {
      const res = await login(normalized, password)
      signIn({ token: res.token, user: res.user, store: null })
      router.replace("/")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] bg-white px-5 py-10">
      <h1 className="text-2xl font-bold">লগইন</h1>
      <p className="mt-1 text-sm text-muted">আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিন।</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <Field
          id="phone"
          label="মোবাইল নম্বর"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="০১৭১২৩৪৫৬৭৮"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneError}
        />
        <PasswordField id="password" label="পাসওয়ার্ড" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button type="submit" full loading={busy}>
          লগইন করুন
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        নতুন দোকান?{" "}
        <Link href="/signup" className="font-medium text-brand">
          দোকান খুলুন
        </Link>
      </p>
    </main>
  )
}
