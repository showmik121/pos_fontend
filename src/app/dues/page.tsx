"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { CustomerPicker } from "@/components/customer-picker"
import { useDb } from "@/components/db-provider"
import { Button } from "@/components/ui/button"
import { Card, RowList } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { Chips } from "@/components/ui/segmented"
import { formatTaka } from "@/lib/domain/money"
import { formatDayMonthBn, localDateIso } from "@/lib/domain/dates"
import { toBanglaDigits } from "@/lib/format/bn"
import { dueRows } from "@/lib/store/selectors"
import { daysSince, isOldDue, OLD_DUE_DAYS, summarizeDues, viewDueRows, type DueFilter, type DueSort } from "@/lib/store/dues-view"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function DuesPage() {
  const { db } = useDb()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<DueFilter>("all")
  const [sort, setSort] = useState<DueSort>("amount")
  const now = useMemo(() => new Date(), [])

  const all = useMemo(() => dueRows(db), [db])
  const summary = useMemo(() => summarizeDues(all, now), [all, now])
  const rows = useMemo(() => viewDueRows(all, { query, filter, sort, now }), [all, query, filter, sort, now])

  return (
    <AppShell
      title="বাকি"
      nav
      action={
        <Button variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> কাস্টমার
        </Button>
      }
    >
      <Card className="px-4 py-3">
        <div className="text-sm text-muted">মোট বাকি</div>
        <div className="text-[28px] font-bold leading-tight text-warn">{formatTaka(summary.total)}</div>
        <div className="text-sm text-muted">
          {toBanglaDigits(summary.count)} জন কাস্টমারের কাছে
          {summary.oldCount > 0 ? ` · ${toBanglaDigits(OLD_DUE_DAYS)} দিনের পুরনো ${formatTaka(summary.oldTotal)} (${toBanglaDigits(summary.oldCount)} জন)` : ""}
        </div>
      </Card>

      <SearchBox id="due-search" label="কাস্টমার খুঁজুন" placeholder="নাম বা মোবাইল" value={query} onChange={(e) => setQuery(e.target.value)} />

      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "সব" },
          { value: "old", label: `${toBanglaDigits(OLD_DUE_DAYS)} দিনের পুরনো` },
        ]}
      />

      {rows.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{db.customers.length === 0 ? "এখনো কোনো কাস্টমার নেই।" : "কোনো বাকি নেই।"}</Card>
      ) : (
        <RowList>
          <div role="row" className="grid grid-cols-[1fr_auto_auto] items-center gap-3 bg-canvas px-4 py-2 text-[13px] font-semibold text-muted">
            <button type="button" className="text-left" aria-pressed={sort === "name"} onClick={() => setSort("name")}>নাম{sort === "name" ? " ↓" : ""}</button>
            <button type="button" className="w-20 text-left" aria-pressed={sort === "oldest"} onClick={() => setSort("oldest")}>শেষ লেনদেন{sort === "oldest" ? " ↓" : ""}</button>
            <button type="button" className="w-20 text-right" aria-pressed={sort === "amount"} onClick={() => setSort("amount")}>বাকি{sort === "amount" ? " ↓" : ""}</button>
          </div>
          {rows.map((r) => {
            const days = daysSince(r.lastAt, now)
            return (
              <Link key={r.customer.id} href={`/dues/customer?id=${r.customer.id}`} className="grid min-h-[56px] grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-1.5 active:bg-canvas">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.customer.name}</div>
                  {r.customer.phone ? <div className="truncate text-[13px] text-muted">{toBanglaDigits(r.customer.phone)}</div> : null}
                  {r.customer.promise ? <div className="truncate text-[13px] text-brand-dark">দেবে {formatDayMonthBn(r.customer.promise.date)}</div> : null}
                </div>
                <div className="w-20 text-[13px] leading-snug text-muted">
                  {formatDayMonthBn(localDateIso(new Date(r.lastAt)))}
                  <div className={isOldDue(r, now) ? "font-medium text-warn" : ""}>{days === 0 ? "আজ" : `${toBanglaDigits(days)} দিন আগে`}</div>
                </div>
                <div className="w-20 text-right font-semibold text-warn">{formatTaka(r.balance)}</div>
              </Link>
            )
          })}
          <div className="flex items-center justify-between bg-canvas px-4 py-2.5 text-sm font-semibold">
            <span>মোট ({toBanglaDigits(rows.length)} জন)</span>
            <span className="text-warn">{formatTaka(rows.reduce((s, r) => s + r.balance, 0))}</span>
          </div>
        </RowList>
      )}

      <CustomerPicker
        open={adding}
        onClose={() => setAdding(false)}
        onPick={(id) => {
          setAdding(false)
          router.push(`/dues/customer?id=${id}`)
        }}
      />
    </AppShell>
  )
}
