"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { CustomerPicker } from "@/components/customer-picker"
import { useDb } from "@/components/db-provider"
import { Button } from "@/components/ui/button"
import { Card, Row, RowList } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { formatTaka } from "@/lib/domain/money"
import { formatDayMonthBn, localDateIso } from "@/lib/domain/dates"
import { toAsciiDigits, toBanglaDigits } from "@/lib/format/bn"
import { dueRows, totalDue } from "@/lib/store/selectors"
import { useRouter } from "next/navigation"

export default function DuesPage() {
  const { db } = useDb()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const q = toAsciiDigits(query).trim().toLowerCase()
    return dueRows(db)
      .filter((r) => !q || r.customer.name.toLowerCase().includes(q) || r.customer.phone.includes(q))
      .sort((a, b) => b.balance - a.balance)
  }, [db, query])

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
        <div className="text-[28px] font-bold leading-tight text-warn">{formatTaka(totalDue(db))}</div>
        <div className="text-sm text-muted">{toBanglaDigits(dueRows(db).length)} জন কাস্টমারের কাছে</div>
      </Card>

      <SearchBox id="due-search" label="কাস্টমার খুঁজুন" placeholder="নাম বা মোবাইল" value={query} onChange={(e) => setQuery(e.target.value)} />

      {rows.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{db.customers.length === 0 ? "এখনো কোনো কাস্টমার নেই।" : "কোনো বাকি নেই।"}</Card>
      ) : (
        <RowList>
          {rows.map((r) => (
            <Row
              key={r.customer.id}
              href={`/dues/customer?id=${r.customer.id}`}
              title={r.customer.name}
              subtitle={`সর্বশেষ ${formatDayMonthBn(localDateIso(new Date(r.lastAt)))}`}
              right={<span className="font-semibold text-warn">{formatTaka(r.balance)}</span>}
              chevron
            />
          ))}
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
