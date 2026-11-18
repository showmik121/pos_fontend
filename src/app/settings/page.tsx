"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { BackupSection } from "@/components/backup-section"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Row, RowList, SectionTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { toAsciiDigits } from "@/lib/format/bn"
import { formatPhoneBn } from "@/lib/format/phone"
import { updateSettings } from "@/lib/store/actions"
import { DEMO_ENABLED } from "@/lib/config"
import { withDemoData } from "@/lib/store/seed"

const KIND_LABEL = { pharmacy: "ফার্মেসি", cosmetics: "কসমেটিক্স", other: "অন্যান্য" } as const

export default function SettingsPage() {
  const { state, signOut } = useAuth()
  const { db, update } = useDb()
  const [minStock, setMinStock] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (state.status !== "authed") return <AppShell title="সেটিংস" backHref="/">{null}</AppShell>
  const { user, store } = state
  const minValue = minStock ?? String(db.settings.defaultMinStock)

  const saveMin = () => {
    const n = Number(toAsciiDigits(minValue))
    if (!Number.isInteger(n) || n < 0) return
    update((d) => updateSettings(d, { defaultMinStock: n }))
    setMinStock(null)
    setSaved(true)
  }

  return (
    <AppShell title="সেটিংস" backHref="/">
      <RowList>
        <Row title="দোকান" right={<span className="font-medium">{store?.name ?? "—"}</span>} />
        <Row title="ধরন" right={<span className="font-medium">{store ? KIND_LABEL[store.kind] : "—"}</span>} />
        <Row title="আপনি" right={<span className="font-medium">{user.name}</span>} />
        <Row title="মোবাইল" right={<span className="font-medium">{formatPhoneBn(user.phone)}</span>} />
        <Row title="ভূমিকা" right={<span className="font-medium">{user.role === "owner" ? "মালিক" : "কর্মচারী"}</span>} />
      </RowList>

      {user.role === "owner" ? (
        <RowList>
          <Row href="/settings/staff" title="কর্মচারী" chevron />
          <Row href="/products/import" title="CSV থেকে পণ্য আনুন" chevron />
        </RowList>
      ) : null}

      <SectionTitle>স্টক</SectionTitle>
      <div className="space-y-2">
        <Field id="set-min" label="নতুন পণ্যের ডিফল্ট সর্বনিম্ন স্টক" inputMode="numeric" value={minValue} onChange={(e) => (setSaved(false), setMinStock(e.target.value))} />
        <Button variant="secondary" onClick={saveMin} disabled={minStock === null}>
          সেভ করুন
        </Button>
        {saved ? <p className="text-sm text-brand-dark">সেভ হয়েছে।</p> : null}
      </div>

      <SectionTitle>তথ্য সংরক্ষণ</SectionTitle>
      <Banner tone="warn">পণ্য, বিল ও বাকির তথ্য এখন শুধু এই ফোনেই সেভ হচ্ছে — সার্ভারে সিংক শীঘ্রই আসছে। ব্রাউজারের ডেটা মুছলে এই তথ্যও মুছে যাবে।</Banner>

      <BackupSection storeId={store?.id ?? ""} />

      {DEMO_ENABLED && db.products.length === 0 ? (
        <Button variant="secondary" full onClick={() => update((d) => withDemoData(d, new Date()))}>
          নমুনা তথ্য দিয়ে দেখুন
        </Button>
      ) : null}

      <Button variant="danger" full onClick={signOut}>
        লগআউট
      </Button>
    </AppShell>
  )
}
