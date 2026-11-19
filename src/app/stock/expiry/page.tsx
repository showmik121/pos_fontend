"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { Button } from "@/components/ui/button"
import { Card, Pill, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Chips } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { localDateIso, todayIso } from "@/lib/domain/dates"
import { domainMessage } from "@/lib/domain/errors"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { formatDateBn } from "@/lib/domain/dates"
import { removeBatch } from "@/lib/store/actions"
import { expiryBuckets, removedBatchLoss, removedBatchLog, type ExpiryRow } from "@/lib/store/selectors"
import { Banner } from "@/components/ui/banner"

type Range = "30" | "60" | "90"

const REMOVE_REASONS = ["মেয়াদ শেষ", "নষ্ট বা ভাঙা", "অন্য কারণ"] as const
const LOG_SHOWN = 10

function describe(row: ExpiryRow): string {
  const batch = row.batch.batchNo ? `ব্যাচ ${row.batch.batchNo} · ` : ""
  return `${batch}${formatCount(row.batch.qtyRemaining)} পিস · ${row.batch.expiryDate ? formatDateBn(row.batch.expiryDate) : ""}`
}

export default function ExpiryPage() {
  const { db, update } = useDb()
  const { state } = useAuth()
  const today = todayIso()
  const [range, setRange] = useState<Range>("90")
  const [removing, setRemoving] = useState<ExpiryRow | null>(null)
  const [reason, setReason] = useState<string>(REMOVE_REASONS[0])
  const [removeError, setRemoveError] = useState<string | null>(null)
  const log = removedBatchLog(db)

  const buckets = expiryBuckets(db, today)
  const upcoming = [...buckets.within30, ...(range !== "30" ? buckets.within60 : []), ...(range === "90" ? buckets.within90 : [])]

  return (
    <AppShell title="মেয়াদ" backHref="/stock">
      <Chips
        value={range}
        onChange={setRange}
        options={[
          { value: "30", label: `৩০ দিনের মধ্যে · ${toBanglaDigits(buckets.within30.length)}` },
          { value: "60", label: `৬০ দিন · ${toBanglaDigits(buckets.within30.length + buckets.within60.length)}` },
          { value: "90", label: `৯০ দিন · ${toBanglaDigits(buckets.within30.length + buckets.within60.length + buckets.within90.length)}` },
        ]}
      />

      {buckets.expired.length > 0 ? (
        <>
          <SectionTitle>মেয়াদোত্তীর্ণ — বিক্রি বন্ধ</SectionTitle>
          <RowList>
            {buckets.expired.map((r) => (
              <Row
                key={r.batch.id}
                dot="danger"
                title={r.product.name}
                subtitle={describe(r)}
                right={
                  <Button variant="danger" className="min-h-11 px-3 text-sm" onClick={() => (setReason(REMOVE_REASONS[0]), setRemoving(r))}>
                    সরান
                  </Button>
                }
              />
            ))}
          </RowList>
        </>
      ) : null}

      <SectionTitle>মেয়াদ শেষ হবে</SectionTitle>
      {upcoming.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">এই সময়ে কোনো ব্যাচের মেয়াদ শেষ হচ্ছে না।</Card>
      ) : (
        <RowList>
          {upcoming.map((r) => (
            <Row
              key={r.batch.id}
              href={`/products/detail?id=${r.product.id}`}
              dot={r.days <= 30 ? "amber" : "muted"}
              title={r.product.name}
              subtitle={describe(r)}
              right={<Pill tone={r.days <= 30 ? "warn" : "neutral"}>{toBanglaDigits(r.days)} দিন</Pill>}
              chevron
            />
          ))}
        </RowList>
      )}

      {log.length > 0 ? (
        <>
          <SectionTitle>সরানো ব্যাচের খাতা</SectionTitle>
          <Card className="px-4 py-3 text-sm text-muted">
            মোট {toBanglaDigits(log.length)}টি ব্যাচ সরানো হয়েছে; কেনা দামে ক্ষতি {formatTaka(removedBatchLoss(db))}।
          </Card>
          <RowList>
            {log.slice(0, LOG_SHOWN).map((r) => (
              <Row
                key={r.id}
                title={r.productName}
                subtitle={`${r.batchNo ? `ব্যাচ ${r.batchNo} · ` : ""}${formatCount(r.qty)} পিস · ${r.reason} · ${r.by} · ${formatDateBn(localDateIso(new Date(r.at)))}`}
                right={<span className="font-medium">{formatTaka(r.qty * r.costPoisha)}</span>}
              />
            ))}
          </RowList>
        </>
      ) : null}

      <Sheet
        open={removing != null}
        onClose={() => {
          setRemoving(null)
          setRemoveError(null)
        }}
        label="ব্যাচ সরানোর নিশ্চিতকরণ"
      >
        <h2 className="text-lg font-bold">ব্যাচটি সরাবেন?</h2>
        <p className="text-muted">
          {removing?.product.name} — {removing ? describe(removing) : ""}। এই ব্যাচের {removing ? formatCount(removing.batch.qtyRemaining) : ""} পিস স্টক থেকে মুছে যাবে। সরানো ব্যাচ ফেরানো যায় না, তবে খাতায় লেখা থাকে।
        </p>
        <Chips value={reason} onChange={setReason} options={REMOVE_REASONS.map((r) => ({ value: r, label: r }))} />
        {removeError ? <Banner tone="danger">{removeError}</Banner> : null}
        <Button
          variant="danger"
          full
          onClick={() => {
            if (!removing || state.status !== "authed") return
            try {
              update((d) => removeBatch(d, removing.batch.id, { by: state.user.name, reason }, new Date()))
              setRemoving(null)
              setRemoveError(null)
            } catch (err) {
              setRemoveError(domainMessage(err))
            }
          }}
        >
          হ্যাঁ, সরান
        </Button>
        <Button
          variant="secondary"
          full
          onClick={() => {
            setRemoving(null)
            setRemoveError(null)
          }}
        >
          না, রেখে দিন
        </Button>
      </Sheet>
    </AppShell>
  )
}
