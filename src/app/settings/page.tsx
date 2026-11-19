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
import { Sheet } from "@/components/ui/sheet"
import { downloadBackup } from "@/lib/browser/backup-download"
import { toAsciiDigits } from "@/lib/format/bn"
import { formatPhoneBn } from "@/lib/format/phone"
import { updateSettings } from "@/lib/store/actions"
import { DEMO_ENABLED } from "@/lib/config"
import { withDemoData } from "@/lib/store/seed"
import { wipeStoreData } from "@/lib/store/wipe"

const KIND_LABEL = { pharmacy: "ফার্মেসি", cosmetics: "কসমেটিক্স", other: "অন্যান্য" } as const

export default function SettingsPage() {
  const { state, signOut } = useAuth()
  const { db, update } = useDb()
  const [minStock, setMinStock] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // লগআউটের ধাপ: null = বন্ধ, "choose" = ফোনে ডেটা রাখবেন নাকি মুছবেন, "wipe" = মোছার নিশ্চিতকরণ
  const [logoutStep, setLogoutStep] = useState<null | "choose" | "wipe">(null)
  const [backedUp, setBackedUp] = useState(false)
  const [wipeFailed, setWipeFailed] = useState(false)

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

  const closeLogout = () => {
    setLogoutStep(null)
    setBackedUp(false)
    setWipeFailed(false)
  }

  const logoutAndWipe = () => {
    if (!store || !backedUp) return
    const ok = wipeStoreData(typeof window === "undefined" ? undefined : window.localStorage, store.id)
    if (!ok) {
      setWipeFailed(true)
      return
    }
    signOut()
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

      <Button variant="danger" full onClick={() => setLogoutStep("choose")}>
        লগআউট
      </Button>

      <Sheet open={logoutStep != null} onClose={closeLogout} label="লগআউট">
        {logoutStep === "wipe" ? (
          <>
            <h2 className="text-lg font-bold">এই ফোন থেকে ডেটা মুছবেন?</h2>
            <Banner tone="danger">
              এই ফোনের পণ্য, বিল ও বাকির খাতা মুছে যাবে। সার্ভারে এসবের কপি নেই, তাই ব্যাকআপ ছাড়া এগুলো আর ফেরানো যাবে না।
            </Banner>
            <Button
              variant="secondary"
              full
              onClick={() => {
                if (store) downloadBackup(db, store.id)
                setBackedUp(true)
              }}
            >
              আগে ব্যাকআপ নামান
            </Button>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={backedUp} onChange={(e) => setBackedUp(e.target.checked)} />
              <span>আমি ব্যাকআপ নিয়েছি, অথবা এই ডেটা আর লাগবে না</span>
            </label>
            {wipeFailed ? <Banner tone="danger">ডেটা মোছা যায়নি। ব্রাউজারের সেটিংস থেকে এই সাইটের ডেটা মুছুন, তারপর আবার চেষ্টা করুন।</Banner> : null}
            <Button variant="danger" full disabled={!backedUp} onClick={logoutAndWipe}>
              লগআউট করুন ও ডেটা মুছুন
            </Button>
            <Button variant="secondary" full onClick={closeLogout}>
              না, ফিরে যান
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold">লগআউট করবেন?</h2>
            <p className="text-muted">লগআউট করলেও পণ্য, বিল ও বাকির খাতা এই ফোনে থেকে যায়; আবার লগইন করলেই ফিরে পাবেন। ফোনটি অন্য কেউ ব্যবহার করলে বা বিক্রি করলে ডেটা মুছে নিন।</p>
            <Button full onClick={signOut}>
              লগআউট (ডেটা ফোনে থাকবে)
            </Button>
            <Button variant="danger" full onClick={() => setLogoutStep("wipe")}>
              লগআউট ও এই ফোনের ডেটা মুছুন
            </Button>
            <Button variant="secondary" full onClick={closeLogout}>
              না, থাকুন
            </Button>
          </>
        )}
      </Sheet>
    </AppShell>
  )
}
