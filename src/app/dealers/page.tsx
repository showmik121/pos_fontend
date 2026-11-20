"use client"

import { tr, tf } from "@/lib/i18n"
import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, Row, RowList } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { Sheet } from "@/components/ui/sheet"
import { formatDayMonthBn, todayIso } from "@/lib/domain/dates"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { addDealer, DEALER_NAME_MAX, dealerRows, payableSummary } from "@/lib/store/dealers"
import { useRouter } from "next/navigation"

export default function DealersPage() {
  const { db, run } = useDb()
  const { isOwner } = useSessionInfo()
  const router = useRouter()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)

  const all = useMemo(() => dealerRows(db, today), [db, today])
  const summary = useMemo(() => payableSummary(all), [all])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((r) => !q || r.dealer.name.toLowerCase().includes(q) || r.dealer.phone.includes(q))
  }, [all, query])

  if (!isOwner) {
    return (
      <AppShell title={tr("ডিলারের পাওনা")} backHref="/">
        <Banner tone="warn">{tr("ডিলারের হিসাব শুধু মালিক দেখতে ও লিখতে পারেন।")}</Banner>
      </AppShell>
    )
  }

  const save = () => {
    setError(null)
    try {
      const id = run((d) => {
        const r = addDealer(d, { name, phone }, new Date())
        return { db: r.db, value: r.dealer.id }
      })
      setAdding(false)
      setName("")
      setPhone("")
      router.push(`/dealers/detail?id=${encodeURIComponent(id)}`)
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <AppShell
      title={tr("ডিলারের পাওনা")}
      backHref="/"
      action={
        <Button variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => { setError(null); setAdding(true) }}>
          <Icon name="plus" size={18} /> {tr("ডিলার")}
        </Button>
      }
    >
      <Card className="px-4 py-3">
        <div className="text-sm text-muted">{tr("মোট দিতে হবে")}</div>
        <div className="text-[28px] font-bold leading-tight text-warn">{formatTaka(summary.total)}</div>
        <div className="text-sm text-muted">
          {tf("{p0} জন ডিলারকে", { p0: toBanglaDigits(summary.count) })}
          {summary.overdueCount > 0 ? tf(" · সময় পেরিয়েছে {p0} ({p1} জন)", { p0: formatTaka(summary.overdueTotal), p1: toBanglaDigits(summary.overdueCount) }) : ""}
        </div>
      </Card>

      {all.length > 0 ? <SearchBox id="dealer-search" label={tr("ডিলার খুঁজুন")} placeholder={tr("নাম বা মোবাইল")} value={query} onChange={(e) => setQuery(e.target.value)} /> : null}

      {all.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("এখনো কোনো ডিলার নেই। ওপরের \"ডিলার\" বোতাম চেপে যোগ করুন।")}</Card>
      ) : rows.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("কাউকে পাওয়া যায়নি।")}</Card>
      ) : (
        <RowList>
          {rows.map((r) => (
            <Row
              key={r.dealer.id}
              href={`/dealers/detail?id=${encodeURIComponent(r.dealer.id)}`}
              dot={r.overdue ? "danger" : r.balance > 0 ? "amber" : "muted"}
              title={r.dealer.name}
              subtitle={
                r.balance > 0 && r.nextDue
                  ? r.overdue
                    ? tf("শোধের তারিখ পেরিয়েছে ({p0})", { p0: formatDayMonthBn(r.nextDue) })
                    : tf("শোধ দিতে হবে {p0}", { p0: formatDayMonthBn(r.nextDue) })
                  : r.balance < 0
                    ? tr("অগ্রিম দেওয়া আছে")
                    : r.balance === 0
                      ? tr("হিসাব মেটানো")
                      : undefined
              }
              right={<span className={r.balance > 0 ? "font-semibold text-warn" : "text-muted"}>{formatTaka(Math.abs(r.balance))}</span>}
              chevron
              tall
            />
          ))}
        </RowList>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} label={tr("নতুন ডিলার")}>
        <h2 className="text-lg font-bold">{tr("নতুন ডিলার")}</h2>
        <Field id="dealer-name" label={tr("ডিলারের নাম")} placeholder={tr("যেমন: রহমান ট্রেডার্স")} maxLength={DEALER_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Field id="dealer-phone" label={tr("মোবাইল নম্বর (ইচ্ছা হলে)")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button full onClick={save} disabled={!name.trim()}>
          {tr("ডিলার যোগ করুন")}
        </Button>
      </Sheet>
    </AppShell>
  )
}
