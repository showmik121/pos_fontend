"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, Pill, Row, RowList } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { Chips } from "@/components/ui/segmented"
import { todayIso } from "@/lib/domain/dates"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { searchProducts } from "@/lib/store/search"
import { expiringSoonCount, isLowStock, lowStockProducts, nearestExpiryDays, sellableStock } from "@/lib/store/selectors"
import { toBanglaDigits } from "@/lib/format/bn"

type Filter = "all" | "low" | "expiry"

export default function StockPage() {
  const { db, update } = useDb()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const lowCount = lowStockProducts(db, today).length
  const soonCount = expiringSoonCount(db, today)

  const rows = useMemo(() => {
    return searchProducts(db, query).filter((p) => {
      if (filter === "low") return isLowStock(db, p, today)
      if (filter === "expiry") {
        const d = nearestExpiryDays(db, p.id, today)
        return d != null && d <= 30
      }
      return true
    })
  }, [db, query, filter, today])

  return (
    <AppShell
      title="স্টক"
      nav
      action={
        <LinkButton href="/stock/in" className="min-h-10 px-3 text-sm">
          <Icon name="plus" size={18} /> স্টক যোগ
        </LinkButton>
      }
    >
      <SearchBox id="stock-search" label="স্টকে পণ্য খুঁজুন" placeholder="নাম বা বারকোড" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "সব" },
          { value: "low", label: `স্টক কম · ${toBanglaDigits(lowCount)}` },
          { value: "expiry", label: `মেয়াদ কাছে · ${toBanglaDigits(soonCount)}` },
        ]}
      />

      {db.products.length === 0 ? (
        <Card className="space-y-3 px-4 py-6 text-center">
          <p className="font-medium">এখনো কোনো পণ্য নেই</p>
          <p className="text-sm text-muted">নতুন পণ্য যোগ করুন, অথবা CSV ফাইল থেকে একসাথে আনুন।</p>
          <div className="flex flex-col gap-2">
            <LinkButton href="/products/new">নতুন পণ্য যোগ করুন</LinkButton>
            <LinkButton href="/products/import" variant="secondary">
              CSV থেকে আনুন
            </LinkButton>
            <Button variant="ghost" onClick={() => import("@/lib/store/seed").then((m) => update((d) => m.withDemoData(d, new Date())))}>
              নমুনা তথ্য দিয়ে দেখুন
            </Button>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">এই ফিল্টারে কোনো পণ্য নেই</Card>
      ) : (
        <RowList>
          {rows.map((p) => {
            const sellable = sellableStock(db, p.id, today)
            const days = nearestExpiryDays(db, p.id, today)
            const low = sellable < p.minStock
            return (
              <Row
                key={p.id}
                href={`/products/detail?id=${p.id}`}
                title={p.name}
                subtitle={`${formatTaka(p.pricePoisha)} · স্টক ${formatCount(sellable)}`}
                right={
                  days != null && days <= 30 ? <Pill tone="warn">মেয়াদ {toBanglaDigits(days)} দিন</Pill> : low ? <Pill tone="danger">স্টক কম</Pill> : undefined
                }
                chevron
              />
            )
          })}
        </RowList>
      )}

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/products/new" variant="secondary">
          নতুন পণ্য
        </LinkButton>
        <LinkButton href="/products/open" variant="secondary">
          খোলা পণ্য
        </LinkButton>
      </div>
      <LinkButton href="/products/import" variant="ghost" full>
        CSV থেকে পণ্য আনুন
      </LinkButton>
    </AppShell>
  )
}
