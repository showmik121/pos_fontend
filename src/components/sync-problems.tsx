"use client"

import { useMemo } from "react"
import { toBanglaDigits } from "@/lib/format/bn"
import { tf, tr } from "@/lib/i18n"
import { stuckDeferred } from "@/lib/sync/tracking"
import { useAuth } from "./auth-provider"
import { useDb } from "./db-provider"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"
import { SectionTitle } from "./ui/card"

const SHOWN = 20

/** তালিকা দীর্ঘ হলে প্রথম কয়েকটি; ধরন ও কোড সাপোর্টকে জানানোর জন্য (সার্ভারের বার্তা হুবহু নয়: তাতে মান থাকতে পারে) */
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
  const { state } = useAuth()
  const { syncInfo, readSyncState, retryRejectedEvents, ackSyncDamaged, ackSyncNotes } = useDb()
  // সিংকের কিউ দোকান-ভিত্তিক, ব্যবহারকারী-ভিত্তিক নয়: মালিকের কিউ-করা ইভেন্টের ধরন কর্মচারীকে দেখাই না, শুধু সংখ্যা
  const isOwner = state.status === "authed" && state.user.role === "owner"
  // প্রতি রেন্ডারে localStorage পড়ি না: সিংক-তথ্য বদলালেই আবার পড়ি
  // syncInfo এখানে ভেতরে ব্যবহৃত নয়, কিন্তু এটিই "সিংক-অবস্থা বদলেছে" সংকেত: এটি বদলালে আবার পড়তে হবে
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const st = useMemo(() => readSyncState(), [readSyncState, syncInfo])
  const stuck = useMemo(() => stuckDeferred(st, new Date()), [st])
  if (syncInfo.problems === 0 && syncInfo.notes === 0) return null
  const n = (x: number) => toBanglaDigits(String(x))
  return (
    <section className="space-y-3">
      <SectionTitle>{tr("সিংকের সমস্যা")}</SectionTitle>
      {st.damaged ? (
        <Banner tone="warn">
          <p>{tr("এই ফোনের সিংক-অবস্থা নষ্ট ছিল; ডেটা নতুন করে সার্ভারে পাঠানো হচ্ছে। কিছু পুরনো বাতিল বা বাকি-আদায়ের ইতিহাস না-ও যেতে পারে — ব্যাকআপ নিয়ে রাখুন।")}</p>
          {isOwner ? (
            <div className="mt-2">
              <Button variant="secondary" onClick={ackSyncDamaged}>
                {tr("বুঝেছি")}
              </Button>
            </div>
          ) : null}
        </Banner>
      ) : null}
      {st.rejected.length > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি বদল সার্ভার নেয়নি (ফোনে আছে)", { p0: n(st.rejected.length) })}</p>
          {isOwner ? (
            <>
              <Items rows={st.rejected.map((r) => ({ id: r.event.id, kind: r.event.kind, note: r.code || String(r.status) }))} />
              <div className="mt-2">
                <Button variant="secondary" onClick={retryRejectedEvents}>
                  {tr("আবার পাঠান")}
                </Button>
              </div>
            </>
          ) : null}
        </Banner>
      ) : null}
      {st.skipped.length > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি তথ্য এই ফোনে বসানো যায়নি — অ্যাপ পুরনো হতে পারে; হালনাগাদ হলে নিজে আবার চেষ্টা হবে", { p0: n(st.skipped.length) })}</p>
          {isOwner ? <Items rows={st.skipped.map((s) => ({ id: s.event.id, kind: s.event.kind, note: s.reason }))} /> : null}
        </Banner>
      ) : null}
      {stuck.length > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি তথ্য ২৪ ঘণ্টার বেশি অপেক্ষায় — অন্য ফোনের তথ্য এখনো আসেনি", { p0: n(stuck.length) })}</p>
          {isOwner ? <Items rows={stuck.map((e) => ({ id: e.id, kind: e.kind, note: "" }))} /> : null}
        </Banner>
      ) : null}
      {st.malformed > 0 ? (
        <Banner tone="warn">
          <p>{tf("{p0}টি নষ্ট তথ্য এসেছিল, যা কোনো ফোনই বসাতে পারবে না", { p0: n(st.malformed) })}</p>
          {isOwner ? (
            <div className="mt-2">
              <Button variant="secondary" onClick={ackSyncNotes}>
                {tr("বুঝেছি")}
              </Button>
            </div>
          ) : null}
        </Banner>
      ) : null}
      {st.evicted > 0 ? (
        <Banner tone="info">
          <p>{tf("জায়গা সীমিত, তাই আরও {p0}টি পুরনো তথ্য এই তালিকা থেকে বাদ গেছে", { p0: n(st.evicted) })}</p>
          {isOwner ? (
            <div className="mt-2">
              <Button variant="secondary" onClick={ackSyncNotes}>
                {tr("বুঝেছি")}
              </Button>
            </div>
          ) : null}
        </Banner>
      ) : null}
    </section>
  )
}
