"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ExpenseSheet } from "@/components/expense-sheet"
import { Banner } from "@/components/ui/banner"
import { Card, SectionTitle, StatBox } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { addDays, BN_MONTHS, formatDayMonthBn, todayIso } from "@/lib/domain/dates"
import { formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { categoryTotals, expensesBetween, expenseTotal, monthRange } from "@/lib/store/expenses"
import { periodSummary } from "@/lib/store/selectors"
import type { Expense } from "@/lib/store/types"

/** মাসের কোনো একটি তারিখ থেকে আগের/পরের মাসের ১ তারিখ */
const shiftMonth = (date: string, by: 1 | -1): string => {
  const [from, to] = monthRange(date)
  return by === 1 ? addDays(to, 1) : addDays(from, -1)
}

export default function ExpenseBookPage() {
  const { db } = useDb()
  const { isOwner } = useSessionInfo()
  const today = todayIso()
  const [anchor, setAnchor] = useState(today)
  const [editing, setEditing] = useState<Expense | null>(null)

  const [from, to] = monthRange(anchor)
  const [y = "", m = "1"] = anchor.split("-")
  const isCurrent = monthRange(today)[0] === from
  const list = useMemo(() => expensesBetween(db, from, to), [db, from, to])
  const totals = useMemo(() => categoryTotals(db, from, to), [db, from, to])
  const total = expenseTotal(db, from, to)
  const sales = periodSummary(db, from, to)
  const names = new Map((db.expenseCategories ?? []).map((c) => [c.id, c]))

  const days = useMemo(() => {
    const out: { date: string; items: Expense[] }[] = []
    for (const x of list) {
      const last = out[out.length - 1]
      if (last && last.date === x.date) last.items.push(x)
      else out.push({ date: x.date, items: [x] })
    }
    return out
  }, [list])

  if (!isOwner) {
    return (
      <AppShell title="খরচের খাতা" backHref="/expenses">
        <Banner tone="warn">খরচের হিসাব শুধু মালিক দেখতে পারেন।</Banner>
      </AppShell>
    )
  }

  return (
    <AppShell title="খরচের খাতা" backHref="/expenses">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="আগের মাস" onClick={() => setAnchor(shiftMonth(anchor, -1))} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white">
          <Icon name="back" />
        </button>
        <div className="text-center font-semibold">
          {BN_MONTHS[Number(m) - 1]} {toBanglaDigits(y)}
        </div>
        <button type="button" aria-label="পরের মাস" disabled={isCurrent} onClick={() => setAnchor(shiftMonth(anchor, 1))} className="grid size-11 place-items-center rounded-xl border border-line-strong bg-white disabled:text-muted/50">
          <Icon name="chevron" />
        </button>
      </div>

      <div className="flex gap-3">
        <StatBox label="মোট খরচ" value={formatTaka(total)} />
        <StatBox label="নিট লাভ" value={formatTaka(sales.profit - total)} />
      </div>
      <p className="text-center text-[13px] text-muted">
        নিট লাভ = আনুমানিক লাভ {formatTaka(sales.profit)} − খরচ {formatTaka(total)}
      </p>

      {totals.length > 0 ? (
        <>
          <SectionTitle>ক্যাটেগরি অনুযায়ী</SectionTitle>
          <Card className="divide-y divide-line">
            {totals.map((c) => (
              <div key={c.categoryId} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium">
                  {c.icon} {c.name}
                </span>
                <span>{formatTaka(c.total)}</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>খরচের তালিকা</SectionTitle>
      {days.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">এই মাসে কোনো খরচ লেখা নেই।</Card>
      ) : (
        days.map((d) => (
          <div key={d.date} className="space-y-1.5">
            <div className="flex items-center justify-between px-1 text-[13px] font-medium text-muted">
              <span>{formatDayMonthBn(d.date)}</span>
              <span>{formatTaka(d.items.reduce((s, x) => s + x.amount, 0))}</span>
            </div>
            <Card className="divide-y divide-line">
              {d.items.map((x) => {
                const c = names.get(x.categoryId)
                return (
                  <button key={x.id} type="button" onClick={() => setEditing(x)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-1.5 text-left active:bg-canvas">
                    <span aria-hidden="true" className="text-2xl">{c?.icon ?? "🧾"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-snug">{c?.name ?? "অন্যান্য"}</div>
                      {x.note ? <div className="truncate text-[13px] text-muted">{x.note}</div> : null}
                    </div>
                    <span className="font-semibold">{formatTaka(x.amount)}</span>
                  </button>
                )
              })}
            </Card>
          </div>
        ))
      )}

      <ExpenseSheet open={editing !== null} onClose={() => setEditing(null)} categoryId={editing?.categoryId ?? ""} expense={editing ?? undefined} />
    </AppShell>
  )
}
