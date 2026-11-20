"use client"

import { tr } from "@/lib/i18n"
import { AuthShell } from "@/components/auth-shell"
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
      setPhoneError(tr("মোবাইল নম্বর সঠিক নয় (যেমন ০১৭১২৩৪৫৬৭৮)"))
      return
    }
    setPhoneError(null)
    if (!password) {
      setError(tr("পাসওয়ার্ড দিন"))
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
    <AuthShell
      title={tr("লগইন")}
      subtitle={tr("আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিন।")}
      footer={
        <>
          {tr("নতুন দোকান?")}{" "}
          <Link href="/signup" className="font-semibold text-brand">
            {tr("দোকান খুলুন")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="phone"
          label={tr("মোবাইল নম্বর")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={tr("০১৭১২৩৪৫৬৭৮")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneError}
        />
        <PasswordField id="password" label={tr("পাসওয়ার্ড")} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button type="submit" full loading={busy}>
          {tr("লগইন করুন")}
        </Button>
      </form>
    </AuthShell>
  )
}
