"use client"

import { tr, tf } from "@/lib/i18n"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Card, Pill, Row, RowList } from "@/components/ui/card"
import { todayIso } from "@/lib/domain/dates"
import { formatCount } from "@/lib/domain/money"
import { lowStockProducts, sellableStock } from "@/lib/store/selectors"

export default function LowStockPage() {
  const { db } = useDb()
  const today = todayIso()
  const rows = lowStockProducts(db, today)
    .map((p) => ({ p, sellable: sellableStock(db, p.id, today) }))
    .sort((a, b) => a.sellable - b.sellable)

  return (
    <AppShell title={tr("স্টক কম")} backHref="/stock">
      {rows.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("সব পণ্যের স্টক যথেষ্ট আছে।")}</Card>
      ) : (
        <RowList>
          {rows.map(({ p, sellable }) => (
            <Row
              key={p.id}
              href={`/stock/in?product=${p.id}`}
              title={p.name}
              subtitle={tf("আছে {p0} · সর্বনিম্ন {p1}", { p0: (formatCount(sellable)), p1: (formatCount(p.minStock)) })}
              right={<Pill tone={sellable === 0 ? "danger" : "warn"}>{sellable === 0 ? tr("শেষ") : tr("কম")}</Pill>}
              chevron
            />
          ))}
        </RowList>
      )}
      <p className="text-center text-sm text-muted">{tr("পণ্য চাপলে সরাসরি স্টক যোগের ফর্ম খুলবে।")}</p>
    </AppShell>
  )
}
