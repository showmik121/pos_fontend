"use client"

import { tr } from "@/lib/i18n"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { PasswordField } from "@/components/ui/password-field"
import { ApiError, errorMessage } from "@/lib/api/client"
import { createStaff, listStaff, setStaffActive } from "@/lib/api/endpoints"
import type { User } from "@/lib/api/schemas"
import { cn } from "@/lib/cn"
import { formatPhoneBn, normalizeBdPhone } from "@/lib/format/phone"

export default function StaffPage() {
  const { state, signOut } = useAuth()
  const token = state.status === "authed" ? state.token : null
  const me = state.status === "authed" ? state.user : null

  const [staff, setStaff] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    try {
      setStaff(await listStaff(token))
      setLoadError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOut()
      else setLoadError(errorMessage(err))
    }
  }, [token, signOut])

  useEffect(() => {
    void load()
  }, [load])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setFormError(null)
    const normalized = normalizeBdPhone(phone)
    if (!name.trim()) return setFormError(tr("কর্মচারীর নাম দিন"))
    if (!normalized) return setFormError(tr("মোবাইল নম্বর সঠিক নয় (যেমন ০১৭১২৩৪৫৬৭৮)"))
    if (password.length < 8) return setFormError(tr("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে"))
    setBusy(true)
    try {
      const created = await createStaff(token, { name: name.trim(), phone: normalized, password })
      setStaff((prev) => [...(prev ?? []), created])
      setName("")
      setPhone("")
      setPassword("")
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(member: User) {
    if (!token) return
    try {
      const updated = await setStaffActive(token, member.id, !member.active)
      setStaff((prev) => (prev ?? []).map((s) => (s.id === updated.id ? updated : s)))
    } catch (err) {
      setLoadError(errorMessage(err))
    }
  }

  if (me && me.role !== "owner") {
    return (
      <AppShell title={tr("কর্মচারী")} backHref="/settings">
        <Banner tone="warn">{tr("এই পাতা শুধু মালিক দেখতে পারেন।")}</Banner>
      </AppShell>
    )
  }

  return (
    <AppShell title={tr("কর্মচারী")} backHref="/settings">
      {loadError ? <Banner tone="danger">{loadError}</Banner> : null}

      <section className="rounded-2xl border border-line bg-white">
        {staff === null ? (
          <p className="p-4 text-sm text-muted">{tr("লোড হচ্ছে…")}</p>
        ) : staff.length === 0 ? (
          <p className="p-4 text-sm text-muted">{tr("এখনো কোনো কর্মচারী যোগ করা হয়নি।")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {staff.map((s) => (
              <li key={s.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", !s.active && "text-muted line-through")}>{s.name}</p>
                  <p className="text-sm text-muted">{formatPhoneBn(s.phone)}</p>
                </div>
                {s.id !== me?.id ? (
                  <Button variant={s.active ? "secondary" : "primary"} className="min-h-11" onClick={() => toggle(s)}>
                    {s.active ? tr("বন্ধ করুন") : tr("চালু করুন")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={onAdd} noValidate className="space-y-4 rounded-2xl border border-line bg-white p-4">
        <h2 className="font-bold">{tr("নতুন কর্মচারী")}</h2>
        <Field id="staffName" label={tr("নাম")} value={name} onChange={(e) => setName(e.target.value)} />
        <Field id="staffPhone" label={tr("মোবাইল নম্বর")} type="tel" inputMode="tel" placeholder={tr("০১৭১২৩৪৫৬৭৮")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <PasswordField id="staffPassword" label={tr("পাসওয়ার্ড")} autoComplete="new-password" hint={tr("কমপক্ষে ৮ অক্ষর")} value={password} onChange={(e) => setPassword(e.target.value)} />
        {formError ? <Banner tone="danger">{formError}</Banner> : null}
        <Button type="submit" full loading={busy}>
          {tr("যোগ করুন")}
        </Button>
      </form>
    </AppShell>
  )
}
