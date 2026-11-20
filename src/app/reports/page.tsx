"use client"

import { tr, tf } from "@/lib/i18n"
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
    <AppShell title={tr("রিপোর্ট")} nav>
      {!isOwner ? (
        <Banner tone="warn">{tr("রিপোর্ট শুধু মালিক দেখতে পারেন।")}</Banner>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button type="button" aria-label={tr("আগের দিন")} onClick={() => setDate(addDays(date, -1))} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white">
              <Icon name="back" />
            </button>
            <div className="text-center">
              <div className="font-semibold">{formatDateBn(date)}</div>
              {date === today ? <div className="text-[13px] text-muted">{tr("আজ")}</div> : null}
            </div>
            <button
              type="button"
              aria-label={tr("পরের দিন")}
              disabled={date >= today}
              onClick={() => setDate(addDays(date, 1))}
              className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white disabled:text-muted/50"
            >
              <Icon name="chevron" />
            </button>
          </div>

          <div className="flex gap-3">
            <StatBox label={tr("মোট বিক্রি")} value={formatTaka(s.total)} />
            <StatBox label={tr("বিল")} value={tf("{p0}টি", { p0: (toBanglaDigits(s.bills)) })} />
          </div>
          <div className="flex gap-3">
            <StatBox label={tr("আনুমানিক লাভ")} value={formatTaka(s.profit)} />
            <StatBox label={tr("বাকি পড়েছে")} value={formatTaka(s.due)} />
          </div>

          <SectionTitle>{tr("কীভাবে টাকা এলো")}</SectionTitle>
          <Card className="divide-y divide-line">
            <Bar label={tr("ক্যাশ")} value={s.cash} total={s.total} tone="bg-brand" />
            <Bar label={tr("মোবাইল ব্যাংকিং")} value={s.mobile} total={s.total} tone="bg-amber" />
            <Bar label={tr("বাকি")} value={s.due} total={s.total} tone="bg-line-strong" />
          </Card>

          {sum === s.total ? (
            <Banner tone="info">{tr("হিসাব মিলেছে: ক্যাশ + মোবাইল + বাকি = মোট বিক্রি")}</Banner>
          ) : (
            <Banner tone="warn">{tr("হিসাবে")} {formatTaka(Math.abs(sum - s.total))} {tr("গরমিল আছে — বিলগুলো মিলিয়ে দেখুন।")}</Banner>
          )}

          <RowList>
            <KeyValue label={tr("ক্যাশ")} value={formatTaka(s.cash)} />
            <KeyValue label={tr("মোবাইল ব্যাংকিং")} value={formatTaka(s.mobile)} />
            <KeyValue label={tr("বাকি")} value={formatTaka(s.due)} />
            <KeyValue label={tr("মোট")} value={formatTaka(s.total)} strong />
          </RowList>
          <p className="text-[13px] text-muted">{tr("লাভ = বিক্রয় − ক্রয়মূল্য (যে ব্যাচ থেকে বিক্রি হয়েছে তার দামে)।")}</p>

          <SectionTitle>{tr("এই মাসের হিসাব")}</SectionTitle>
          <div className="flex gap-3">
            <StatBox label={tr("বিক্রি")} value={formatTaka(month.total)} />
            <StatBox label={tr("আনুমানিক লাভ")} value={formatTaka(month.profit)} />
          </div>
          <div className="flex gap-3">
            <StatBox label={tr("খরচ")} value={formatTaka(monthExpense)} />
            <StatBox label={tr("নিট লাভ")} value={formatTaka(month.profit - monthExpense)} />
          </div>
          <p className="text-[13px] text-muted">{tr("নিট লাভ = আনুমানিক লাভ − দোকানের খরচ (ভাড়া, বেতন ইত্যাদি)।")}</p>
          <LinkButton href="/expenses" variant="secondary" full>
            {tr("খরচের হিসাব")}
          </LinkButton>

          <LinkButton href="/reports/top" variant="secondary" full>
            {tr("সেরা বিক্রির পণ্য")}
          </LinkButton>
        </>
      )}
    </AppShell>
  )
}
