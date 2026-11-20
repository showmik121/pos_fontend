"use client"

import Link from "next/link"
import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ReportDownloads } from "@/components/report-downloads"
import { Banner } from "@/components/ui/banner"
import { LinkButton } from "@/components/ui/button"
import { Card, Pill, Row, RowList, SectionTitle, StatBox } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { Segmented } from "@/components/ui/segmented"
import { addDays, formatDateBn, todayIso } from "@/lib/domain/dates"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { tf, tr } from "@/lib/i18n"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { expenseTotal } from "@/lib/store/expenses"
import { changePercent, reportRange, type ReportPreset } from "@/lib/store/report-range"
import { expiringSoonCount, lowStockProducts, rangeSummary, topProducts, totalDue } from "@/lib/store/selectors"

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0
  return (
    <div className="space-y-1 px-4 py-2.5">
      <div className="flex items-center justify-between text-[15px]">
        <span className="font-medium">{label}</span>
        <span>{formatTaka(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-chip" aria-hidden="true">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** একটি দিন বেছে নেওয়ার আগে-পরে বোতাম */
function DayStepper({ day, today, onChange }: { day: string; today: string; onChange: (d: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" aria-label={tr("আগের দিন")} onClick={() => onChange(addDays(day, -1))} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white">
        <Icon name="back" />
      </button>
      <div className="font-semibold">{formatDateBn(day)}</div>
      <button
        type="button"
        aria-label={tr("পরের দিন")}
        disabled={day >= today}
        onClick={() => onChange(addDays(day, 1))}
        className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white disabled:text-muted/50"
      >
        <Icon name="chevron" />
      </button>
    </div>
  )
}

function Change({ current, previous }: { current: number; previous: number }) {
  const pct = changePercent(current, previous)
  if (pct === null || pct === 0) return null
  const up = pct > 0
  return <Pill tone={up ? "brand" : "danger"}>{tf(up ? "আগের সময়ের চেয়ে {p0}% বেশি" : "আগের সময়ের চেয়ে {p0}% কম", { p0: toBanglaDigits(Math.abs(pct)) })}</Pill>
}

export default function ReportsPage() {
  const { db } = useDb()
  const { isOwner } = useSessionInfo()
  const today = todayIso()
  const [preset, setPreset] = useState<ReportPreset>("today")
  const [day, setDay] = useState(today)
  const range = reportRange(preset, today, day)
  const s = rangeSummary(db, range.from, range.to)
  const prev = rangeSummary(db, range.prevFrom, range.prevTo)
  const expense = expenseTotal(db, range.from, range.to)
  const top = topProducts(db, range.from, range.to, 5)
  const lowCount = lowStockProducts(db, today).length
  const expiryCount = expiringSoonCount(db, today)
  const dueTotal = totalDue(db)
  const mismatch = Math.abs(s.cash + s.mobile + s.due - s.total)
  const hasAlerts = lowCount > 0 || expiryCount > 0 || dueTotal > 0
  const label = range.from === range.to ? formatDateBn(range.from) : tf("{p0} থেকে {p1}", { p0: formatDateBn(range.from), p1: formatDateBn(range.to) })

  return (
    <AppShell title={tr("রিপোর্ট")} nav>
      {!isOwner ? (
        <Banner tone="warn">{tr("রিপোর্ট শুধু মালিক দেখতে পারেন।")}</Banner>
      ) : (
        <>
          <Segmented
            label={tr("সময়")}
            value={preset}
            onChange={setPreset}
            options={[
              { value: "today", label: tr("আজ") },
              { value: "yesterday", label: tr("গতকাল") },
              { value: "week", label: tr("৭ দিন") },
              { value: "month", label: tr("এই মাস") },
              { value: "day", label: tr("তারিখ") },
            ]}
          />
          {preset === "day" ? <DayStepper day={day} today={today} onChange={setDay} /> : <p className="text-[13px] text-muted">{label}</p>}

          <Card>
            <div className="space-y-1 border-l-4 border-gold px-4 py-4">
              <div className="text-[13px] text-muted">{tr("মোট বিক্রি")}</div>
              <div className="text-[30px] font-bold leading-tight text-brand-dark">{formatTaka(s.total)}</div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[15px] text-muted">{tf("{p0}টি বিল", { p0: toBanglaDigits(s.bills) })}</span>
                <Change current={s.total} previous={prev.total} />
              </div>
            </div>
          </Card>

          {s.bills === 0 && expense === 0 ? (
            <Card className="space-y-3 px-4 py-5 text-center">
              <p className="text-muted">{tr("এই সময়ে কোনো বিক্রি নেই।")}</p>
              <LinkButton href="/sell" full>
                {tr("বিল করুন")}
              </LinkButton>
            </Card>
          ) : (
            <>
              <div className="flex gap-3">
                <StatBox label={tr("আনুমানিক লাভ")} value={formatTaka(s.profit)} />
                <StatBox label={tr("খরচ")} value={formatTaka(expense)} />
              </div>
              <div className="flex gap-3">
                <StatBox label={tr("নিট লাভ")} value={formatTaka(s.profit - expense)} />
                <StatBox label={tr("বাকি পড়েছে")} value={formatTaka(s.due)} />
              </div>
              <p className="text-[13px] text-muted">{tr("নিট লাভ = আনুমানিক লাভ − দোকানের খরচ (ভাড়া, বেতন ইত্যাদি)।")}</p>
            </>
          )}

          {s.total > 0 ? (
            <>
              <SectionTitle>{tr("কীভাবে টাকা এলো")}</SectionTitle>
              <Card className="divide-y divide-line">
                <Bar label={tr("ক্যাশ")} value={s.cash} total={s.total} tone="bg-brand" />
                <Bar label={tr("মোবাইল ব্যাংকিং")} value={s.mobile} total={s.total} tone="bg-amber" />
                <Bar label={tr("বাকি")} value={s.due} total={s.total} tone="bg-line-strong" />
              </Card>
              {mismatch > 0 ? (
                <Banner tone="warn">{tr("হিসাবে")} {formatTaka(mismatch)} {tr("গরমিল আছে — বিলগুলো মিলিয়ে দেখুন।")}</Banner>
              ) : null}
            </>
          ) : null}

          {top.length > 0 ? (
            <>
              <SectionTitle
                right={
                  <Link href="/reports/top" className="flex min-h-11 items-center text-sm font-medium text-brand-dark">
                    {tr("সব দেখুন")}
                  </Link>
                }
              >
                {tr("সেরা ৫ পণ্য")}
              </SectionTitle>
              <RowList>
                {top.map((r, i) => (
                  <Row key={r.productId} title={`${toBanglaDigits(i + 1)}. ${r.name}`} subtitle={tf("{p0} পিস বিক্রি", { p0: formatCount(r.qty) })} right={<span className="font-semibold">{formatTaka(r.revenue)}</span>} />
                ))}
              </RowList>
            </>
          ) : null}

          {hasAlerts ? (
            <>
              <SectionTitle>{tr("নজর দিন")}</SectionTitle>
              <RowList>
                {dueTotal > 0 ? <Row title={tr("মোট বাকি")} subtitle={tr("কাস্টমারদের কাছে পাওনা")} right={<span className="font-semibold">{formatTaka(dueTotal)}</span>} href="/dues" chevron /> : null}
                {lowCount > 0 ? <Row title={tr("কম স্টক")} subtitle={tf("{p0}টি পণ্য", { p0: toBanglaDigits(lowCount) })} dot="amber" href="/stock/low" chevron /> : null}
                {expiryCount > 0 ? <Row title={tr("মেয়াদ শেষ হচ্ছে")} subtitle={tf("{p0}টি ব্যাচ", { p0: toBanglaDigits(expiryCount) })} dot="danger" href="/stock/expiry" chevron /> : null}
              </RowList>
            </>
          ) : null}

          <SectionTitle>{tr("খরচের হিসাব")}</SectionTitle>
          <RowList>
            <Row title={tr("খরচের হিসাব")} subtitle={tr("ভাড়া, বেতন ও অন্য খরচ")} href="/expenses" chevron />
          </RowList>

          <SectionTitle>{tr("এক্সেলে নামান")}</SectionTitle>
          <ReportDownloads />
        </>
      )}
    </AppShell>
  )
}
