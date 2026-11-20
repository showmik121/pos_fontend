"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { LinkButton } from "@/components/ui/button"
import { Card, KeyValue, RowList, SectionTitle, StatBox } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { addDays, formatDateBn, todayIso } from "@/lib/domain/dates"
import { formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { expenseTotal, monthRange } from "@/lib/store/expenses"
import { daySummary, periodSummary } from "@/lib/store/selectors"

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

export default function ReportsPage() {
  const { db } = useDb()
  const { isOwner } = useSessionInfo()
  const today = todayIso()
  const [date, setDate] = useState(today)
  const s = daySummary(db, date)
  const sum = s.cash + s.mobile + s.due
  const [monthFrom, monthTo] = monthRange(today)
  const month = periodSummary(db, monthFrom, monthTo)
  const monthExpense = expenseTotal(db, monthFrom, monthTo)

  return (
    <AppShell title="রিপোর্ট" nav>
      {!isOwner ? (
        <Banner tone="warn">রিপোর্ট শুধু মালিক দেখতে পারেন।</Banner>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button type="button" aria-label="আগের দিন" onClick={() => setDate(addDays(date, -1))} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white">
              <Icon name="back" />
            </button>
            <div className="text-center">
              <div className="font-semibold">{formatDateBn(date)}</div>
              {date === today ? <div className="text-[13px] text-muted">আজ</div> : null}
            </div>
            <button
              type="button"
              aria-label="পরের দিন"
              disabled={date >= today}
              onClick={() => setDate(addDays(date, 1))}
              className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white disabled:text-muted/50"
            >
              <Icon name="chevron" />
            </button>
          </div>

          <div className="flex gap-3">
            <StatBox label="মোট বিক্রি" value={formatTaka(s.total)} />
            <StatBox label="বিল" value={`${toBanglaDigits(s.bills)}টি`} />
          </div>
          <div className="flex gap-3">
            <StatBox label="আনুমানিক লাভ" value={formatTaka(s.profit)} />
            <StatBox label="বাকি পড়েছে" value={formatTaka(s.due)} />
          </div>

          <SectionTitle>কীভাবে টাকা এলো</SectionTitle>
          <Card className="divide-y divide-line">
            <Bar label="ক্যাশ" value={s.cash} total={s.total} tone="bg-brand" />
            <Bar label="মোবাইল ব্যাংকিং" value={s.mobile} total={s.total} tone="bg-amber" />
            <Bar label="বাকি" value={s.due} total={s.total} tone="bg-line-strong" />
          </Card>

          {sum === s.total ? (
            <Banner tone="info">হিসাব মিলেছে: ক্যাশ + মোবাইল + বাকি = মোট বিক্রি</Banner>
          ) : (
            <Banner tone="warn">হিসাবে {formatTaka(Math.abs(sum - s.total))} গরমিল আছে — বিলগুলো মিলিয়ে দেখুন।</Banner>
          )}

          <RowList>
            <KeyValue label="ক্যাশ" value={formatTaka(s.cash)} />
            <KeyValue label="মোবাইল ব্যাংকিং" value={formatTaka(s.mobile)} />
            <KeyValue label="বাকি" value={formatTaka(s.due)} />
            <KeyValue label="মোট" value={formatTaka(s.total)} strong />
          </RowList>
          <p className="text-[13px] text-muted">লাভ = বিক্রয় − ক্রয়মূল্য (যে ব্যাচ থেকে বিক্রি হয়েছে তার দামে)।</p>

          <SectionTitle>এই মাসের হিসাব</SectionTitle>
          <div className="flex gap-3">
            <StatBox label="বিক্রি" value={formatTaka(month.total)} />
            <StatBox label="আনুমানিক লাভ" value={formatTaka(month.profit)} />
          </div>
          <div className="flex gap-3">
            <StatBox label="খরচ" value={formatTaka(monthExpense)} />
            <StatBox label="নিট লাভ" value={formatTaka(month.profit - monthExpense)} />
          </div>
          <p className="text-[13px] text-muted">নিট লাভ = আনুমানিক লাভ − দোকানের খরচ (ভাড়া, বেতন ইত্যাদি)।</p>
          <LinkButton href="/expenses" variant="secondary" full>
            খরচের হিসাব
          </LinkButton>

          <LinkButton href="/reports/top" variant="secondary" full>
            সেরা বিক্রির পণ্য
          </LinkButton>
        </>
      )}
    </AppShell>
  )
}
