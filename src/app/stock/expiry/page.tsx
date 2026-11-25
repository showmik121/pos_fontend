"use client"

import { tr, tf } from "@/lib/i18n"
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
import { formatCount, formatTaka, parseTaka, takaInputValue } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { formatDateBn } from "@/lib/domain/dates"
import { removeBatch, returnBatchToDealer } from "@/lib/store/actions"
import { activeDealers } from "@/lib/store/dealers"
import { expiryBuckets, removedBatchCredit, removedBatchLoss, removedBatchLog, returnList, type ExpiryRow } from "@/lib/store/selectors"
import { Banner } from "@/components/ui/banner"
import { Field } from "@/components/ui/field"
import Link from "next/link"

type Range = "30" | "60" | "90"

const REMOVE_REASONS = ["মেয়াদ শেষ", "নষ্ট বা ভাঙা", "অন্য কারণ"] as const
const LOG_SHOWN = 10

function describe(row: ExpiryRow): string {
  const batch = row.batch.batchNo ? tf("ব্যাচ {p0} · ", { p0: (row.batch.batchNo) }) : ""
  return tf("{p0}{p1} পিস · {p2}", { p0: (batch), p1: (formatCount(row.batch.qtyRemaining)), p2: (row.batch.expiryDate ? formatDateBn(row.batch.expiryDate) : "") })
}

export default function ExpiryPage() {
  const { db, update } = useDb()
  const { state } = useAuth()
  // ব্যাচ সরানো শুধু মালিকের কাজ (সার্ভারের REST ও সিংক দুই জায়গাতেই মালিক-মাত্র); কর্মচারী করলে তার সিংক আটকাত
  const isOwner = state.status === "authed" && state.user.role === "owner"
  const today = todayIso()
  const [range, setRange] = useState<Range>("90")
  const [removing, setRemoving] = useState<ExpiryRow | null>(null)
  const [reason, setReason] = useState<string>(REMOVE_REASONS[0])
  const [removeError, setRemoveError] = useState<string | null>(null)
  const log = removedBatchLog(db)
  const dealers = activeDealers(db)
  const [returning, setReturning] = useState<ExpiryRow | null>(null)
  const [dealerId, setDealerId] = useState("")
  const [credit, setCredit] = useState("")
  const [returnError, setReturnError] = useState<string | null>(null)
  const groups = returnList(db, today)

  function openReturn(row: ExpiryRow, company: string) {
    const match = dealers.find((d) => d.name.trim().toLowerCase() === company.toLowerCase())
    setDealerId(match?.id ?? (dealers.length === 1 ? (dealers[0]?.id ?? "") : ""))
    setCredit(takaInputValue(row.batch.qtyRemaining * row.batch.costPoisha))
    setReturnError(null)
    setReturning(row)
  }

  const buckets = expiryBuckets(db, today)
  const upcoming = [...buckets.within30, ...(range !== "30" ? buckets.within60 : []), ...(range === "90" ? buckets.within90 : [])]

  return (
    <AppShell title={tr("মেয়াদ")} backHref="/stock">
      <Chips
        value={range}
        onChange={setRange}
        options={[
          { value: "30", label: tf("৩০ দিনের মধ্যে · {p0}", { p0: (toBanglaDigits(buckets.within30.length)) }) },
          { value: "60", label: tf("৬০ দিন · {p0}", { p0: (toBanglaDigits(buckets.within30.length + buckets.within60.length)) }) },
          { value: "90", label: tf("৯০ দিন · {p0}", { p0: (toBanglaDigits(buckets.within30.length + buckets.within60.length + buckets.within90.length)) }) },
        ]}
      />

      {buckets.expired.length > 0 ? (
        <>
          <SectionTitle>{tr("মেয়াদোত্তীর্ণ — বিক্রি বন্ধ")}</SectionTitle>
          <RowList>
            {buckets.expired.map((r) => (
              <Row
                key={r.batch.id}
                dot="danger"
                title={r.product.name}
                subtitle={describe(r)}
                right={
                  isOwner ? (
                    <Button variant="danger" className="min-h-11 px-3 text-sm" onClick={() => (setReason(REMOVE_REASONS[0]), setRemoving(r))}>
                      {tr("সরান")}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </RowList>
        </>
      ) : null}

      <SectionTitle>{tr("মেয়াদ শেষ হবে")}</SectionTitle>
      {upcoming.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("এই সময়ে কোনো ব্যাচের মেয়াদ শেষ হচ্ছে না।")}</Card>
      ) : (
        <RowList>
          {upcoming.map((r) => (
            <Row
              key={r.batch.id}
              href={`/products/detail?id=${r.product.id}`}
              dot={r.days <= 30 ? "amber" : "muted"}
              title={r.product.name}
              subtitle={describe(r)}
              right={<Pill tone={r.days <= 30 ? "warn" : "neutral"}>{toBanglaDigits(r.days)} {tr("দিন")}</Pill>}
              chevron
            />
          ))}
        </RowList>
      )}

      {groups.length > 0 ? (
        <>
          <SectionTitle>{tr("ডিলারে ফেরতের তালিকা")}</SectionTitle>
          <Card className="px-4 py-3 text-sm text-muted">{tr("মেয়াদ শেষ হওয়ার আগে ফেরত দিলে ক্ষতি কমে। কোম্পানি ধরে সাজানো; কেনা দামে মূল্য দেখানো হয়েছে।")}</Card>
          {groups.map((g) => (
            <div key={g.company} data-testid="return-group">
              <div className="flex items-baseline justify-between px-1 pb-1 pt-3 text-sm font-bold">
                <span>{tr(g.company)}</span>
                <span className="text-muted">{formatTaka(g.costPoisha)}</span>
              </div>
              <RowList>
                {g.rows.map((r) => (
                  <Row
                    key={r.batch.id}
                    dot={r.days <= 0 ? "danger" : r.days <= 30 ? "amber" : "muted"}
                    title={r.product.name}
                    subtitle={tf("{p0} · {p1}", { p0: describe(r), p1: formatTaka(r.batch.qtyRemaining * r.batch.costPoisha) })}
                    right={
                      isOwner ? (
                        <Button variant="secondary" className="min-h-11 px-3 text-sm" onClick={() => openReturn(r, g.company)}>
                          {tr("ফেরত")}
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </RowList>
            </div>
          ))}
        </>
      ) : null}

      {log.length > 0 ? (
        <>
          <SectionTitle>{tr("সরানো ব্যাচের খাতা")}</SectionTitle>
          <Card className="px-4 py-3 text-sm text-muted">
            {tr("মোট")} {toBanglaDigits(log.length)}{tr("টি ব্যাচ সরানো হয়েছে; কেনা দামে ক্ষতি")} {formatTaka(removedBatchLoss(db))}।
            {removedBatchCredit(db) > 0 ? (
              <>
                {" "}
                {tr("ডিলারে ফেরত দিয়ে ক্রেডিট")} {formatTaka(removedBatchCredit(db))}{tr("; নিট ক্ষতি")} {formatTaka(removedBatchLoss(db) - removedBatchCredit(db))}।
              </>
            ) : null}
          </Card>
          <RowList>
            {log.slice(0, LOG_SHOWN).map((r) => (
              <Row
                key={r.id}
                title={r.productName}
                subtitle={tf("{p0}{p1} পিস · {p2} · {p3} · {p4}", { p0: (r.batchNo ? tf("ব্যাচ {p0} · ", { p0: (r.batchNo) }) : ""), p1: (formatCount(r.qty)), p2: (r.returnedToDealerName ? tf("{p0}-এ ফেরত, ক্রেডিট {p1}", { p0: r.returnedToDealerName, p1: formatTaka(r.creditPoisha ?? 0) }) : r.reason), p3: (r.by), p4: (formatDateBn(localDateIso(new Date(r.at)))) })}
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
        label={tr("ব্যাচ সরানোর নিশ্চিতকরণ")}
      >
        <h2 className="text-lg font-bold">{tr("ব্যাচটি সরাবেন?")}</h2>
        <p className="text-muted">
          {removing?.product.name} — {removing ? describe(removing) : ""}{tr("। এই ব্যাচের")} {removing ? formatCount(removing.batch.qtyRemaining) : ""} {tr("পিস স্টক থেকে মুছে যাবে। সরানো ব্যাচ ফেরানো যায় না, তবে খাতায় লেখা থাকে।")}
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
          {tr("হ্যাঁ, সরান")}
        </Button>
        <Button
          variant="secondary"
          full
          onClick={() => {
            setRemoving(null)
            setRemoveError(null)
          }}
        >
          {tr("না, রেখে দিন")}
        </Button>
      </Sheet>

      <Sheet
        open={returning != null}
        onClose={() => {
          setReturning(null)
          setReturnError(null)
        }}
        label={tr("ডিলারে ফেরত")}
      >
        <h2 className="text-lg font-bold">{tr("ডিলারে ফেরত দেবেন?")}</h2>
        <p className="text-muted">
          {returning?.product.name} — {returning ? describe(returning) : ""}{tr("। ব্যাচটি স্টক থেকে সরে যাবে এবং খাতায় ফেরত হিসেবে লেখা থাকবে।")}
        </p>
        {dealers.length === 0 ? (
          <Banner tone="warn">
            {tr("আগে ডিলার যোগ করুন")} — <Link href="/dealers/" className="underline">{tr("ডিলারের পাতা")}</Link>
          </Banner>
        ) : (
          <Chips value={dealerId} onChange={setDealerId} options={dealers.map((d) => ({ value: d.id, label: d.name }))} />
        )}
        <Field
          id="return-credit"
          label={tr("ক্রেডিট (টাকা) — ডিলার যত টাকা কাটবে")}
          hint={tr("বদলে মাল পেলে ০ দিন। ক্রেডিট দিলে ডিলারের খাতায় জমা হবে।")}
          inputMode="decimal"
          value={credit}
          onChange={(e) => setCredit(e.target.value)}
        />
        {returnError ? <Banner tone="danger">{returnError}</Banner> : null}
        <Button
          full
          onClick={() => {
            if (!returning || state.status !== "authed") return
            const poisha = parseTaka(credit)
            if (poisha === null) return setReturnError(tr("ক্রেডিটের টাকা সঠিক নয়"))
            try {
              update((d) => returnBatchToDealer(d, returning.batch.id, { dealerId, creditPoisha: poisha, by: state.user.name }, new Date()))
              setReturning(null)
              setReturnError(null)
            } catch (err) {
              setReturnError(domainMessage(err))
            }
          }}
        >
          {tr("ফেরত দিন")}
        </Button>
        <Button variant="secondary" full onClick={() => (setReturning(null), setReturnError(null))}>
          {tr("থাক")}
        </Button>
      </Sheet>
    </AppShell>
  )
}
