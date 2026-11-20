"use client"

import { toBanglaDigits } from "@/lib/format/bn"
import { tf, tr } from "@/lib/i18n"
import { stuckDeferred } from "@/lib/sync/tracking"
import { useDb } from "./db-provider"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"
import { SectionTitle } from "./ui/card"

const SHOWN = 20

/** তালিকা দীর্ঘ হলে প্রথম কয়েকটি; ধরন ও কারণ সাপোর্টকে জানানোর জন্য */
function Items({ rows }: { rows: Array<{ id: string; kind: string; note: string }> }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted">
      {rows.slice(0, SHOWN).map((r) => (
        <li key={r.id} className="break-words">
          <span className="font-mono">{r.kind}</span>
          {r.note ? ` · ${r.note}` : ""}
        </li>
      ))}
      {rows.length > SHOWN ? <li>… +{toBanglaDigits(String(rows.length - SHOWN))}</li> : null}
    </ul>
  )
}

/** সেটিংস › ডেটা ও ব্যাকআপে: সিংকে যা সার্ভারে যায়নি বা এই ফোনে বসেনি, সব দেখায়; কিছুই চুপচাপ হারায় না */
export function SyncProblems() {
  const { syncInfo, readSyncState, retryRejectedEvents, ackSyncDamaged } = useDb()
  if (syncInfo.problems === 0 && syncInfo.evicted === 0) return null
  const st = readSyncState()
  const stuck = stuckDeferred(st, new Date())
  const n = (x: number) => toBanglaDigits(String(x))
  return (
    <section className="space-y-3">
      <SectionTitle>{tr("সিংকের সমস্যা")}</SectionTitle>
      {st.damaged ? (
        <Banner tone="warn">
          <p>{tr("এই ফোনের সিংক-অবস্থা নষ্ট ছিল; ডেটা নতুন করে সার্ভারে পাঠানো হচ্ছে। কিছু পুরনো বাতিল বা বাকি-আদায়ের ইতিহাস না-ও যেতে পারে — ব্যাকআপ নিয়ে রাখুন।")}</p>
          <div className="mt-2">
            <Button variant="secondary" onClick={ackSyncDamaged}>
              {tr("বুঝেছি")}
            </Button>
          </div>
        </Banner>
      ) : null}
      {st.rejected.length > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি বদল সার্ভার নেয়নি (ফোনে আছে)", { p0: n(st.rejected.length) })}</p>
          <Items rows={st.rejected.map((r) => ({ id: r.event.id, kind: r.event.kind, note: r.message }))} />
          <div className="mt-2">
            <Button variant="secondary" onClick={retryRejectedEvents}>
              {tr("আবার পাঠান")}
            </Button>
          </div>
        </Banner>
      ) : null}
      {st.skipped.length > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি তথ্য এই ফোনে বসানো যায়নি — অ্যাপ পুরনো হতে পারে; হালনাগাদ হলে নিজে আবার চেষ্টা হবে", { p0: n(st.skipped.length) })}</p>
          <Items rows={st.skipped.map((s) => ({ id: s.event.id, kind: s.event.kind, note: s.reason }))} />
        </Banner>
      ) : null}
      {stuck.length > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি তথ্য ২৪ ঘণ্টার বেশি অপেক্ষায় — অন্য ফোনের তথ্য এখনো আসেনি", { p0: n(stuck.length) })}</p>
          <Items rows={stuck.map((e) => ({ id: e.id, kind: e.kind, note: "" }))} />
        </Banner>
      ) : null}
      {st.malformed > 0 ? <Banner tone="warn">{tf("{p0}টি নষ্ট তথ্য এসেছিল, যা কোনো ফোনই বসাতে পারবে না", { p0: n(st.malformed) })}</Banner> : null}
      {st.evicted > 0 ? <Banner tone="info">{tf("জায়গা সীমিত, তাই আরও {p0}টি পুরনো তথ্য এই তালিকা থেকে বাদ গেছে", { p0: n(st.evicted) })}</Banner> : null}
    </section>
  )
}
