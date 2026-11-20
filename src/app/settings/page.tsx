"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Row, RowList, type DotTone } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Sheet } from "@/components/ui/sheet"
import { ApiError, errorMessage } from "@/lib/api/client"
import { renameStore } from "@/lib/api/endpoints"
import { downloadBackup } from "@/lib/browser/backup-download"
import { formatPhoneBn } from "@/lib/format/phone"
import { DEMO_ENABLED } from "@/lib/config"
import { STORE_NAME_MAX, cleanStoreName } from "@/lib/store-name"
import { withDemoData } from "@/lib/store/seed"
import { wipeStoreData } from "@/lib/store/wipe"

const KIND_LABEL = { pharmacy: "ফার্মেসি", cosmetics: "কসমেটিক্স", other: "রিটেইল" } as const

export default function SettingsPage() {
  const { state, signOut, setStore } = useAuth()
  const { db, update, syncInfo } = useDb()
  // লগআউটের ধাপ: null = বন্ধ, "choose" = ফোনে ডেটা রাখবেন নাকি মুছবেন, "wipe" = মোছার নিশ্চিতকরণ
  const [logoutStep, setLogoutStep] = useState<null | "choose" | "wipe">(null)
  const [backedUp, setBackedUp] = useState(false)
  const [wipeFailed, setWipeFailed] = useState(false)
  // দোকানের নাম বদল (শুধু মালিক): null = বন্ধ, নইলে ফর্মের লেখা
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState("")

  if (state.status !== "authed") return <AppShell title="সেটিংস" backHref="/">{null}</AppShell>
  const { user, store } = state

  // সেটিংসে ডেটার অবস্থা শুধু এক লাইনে; বিস্তারিত ও ব্যাকআপ "ডেটা ও ব্যাকআপ" পাতায়
  const dataStatus: { text: string; dot: DotTone } =
    syncInfo.status === "auth"
      ? { text: "আবার লগইন করুন", dot: "amber" }
      : syncInfo.pending > 0
        ? { text: "ইন্টারনেট এলে নিজে সুরক্ষিত হবে", dot: "amber" }
        : { text: "সব তথ্য সুরক্ষিত আছে", dot: "brand" }

  const closeRename = () => {
    setNameDraft(null)
    setNameError("")
  }

  const saveName = async () => {
    const name = cleanStoreName(nameDraft ?? "")
    if (!name) return setNameError(`দোকানের নাম লিখুন (সর্বোচ্চ ${STORE_NAME_MAX} অক্ষর)`)
    if (state.status !== "authed") return
    setNameBusy(true)
    try {
      setStore(await renameStore(state.token, name))
      closeRename()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOut()
      else setNameError(errorMessage(err))
    } finally {
      setNameBusy(false)
    }
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
        {user.role === "owner" ? (
          <Row title="দোকান" right={<span className="font-medium">{store?.name ?? "—"}</span>} chevron onClick={() => setNameDraft(store?.name ?? "")} />
        ) : (
          <Row title="দোকান" right={<span className="font-medium">{store?.name ?? "—"}</span>} />
        )}
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

      <RowList>
        <Row href="/settings/data" title="ডেটা ও ব্যাকআপ" subtitle={dataStatus.text} dot={dataStatus.dot} chevron />
      </RowList>

      {DEMO_ENABLED && db.products.length === 0 ? (
        <Button variant="secondary" full onClick={() => update((d) => withDemoData(d, new Date()))}>
          নমুনা তথ্য দিয়ে দেখুন
        </Button>
      ) : null}

      <Button variant="danger" full onClick={() => setLogoutStep("choose")}>
        লগআউট
      </Button>

      <Sheet open={nameDraft !== null} onClose={closeRename} label="দোকানের নাম বদলান">
        <h2 className="text-lg font-bold">দোকানের নাম বদলান</h2>
        <Field id="store-name" label="দোকানের নাম" value={nameDraft ?? ""} maxLength={STORE_NAME_MAX} error={nameError || undefined} onChange={(e) => (setNameError(""), setNameDraft(e.target.value))} />
        <Button full disabled={nameBusy} onClick={saveName}>
          {nameBusy ? "সেভ হচ্ছে…" : "সেভ করুন"}
        </Button>
        <Button variant="secondary" full onClick={closeRename}>
          বাতিল
        </Button>
      </Sheet>

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
