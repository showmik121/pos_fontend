"use client"

import { tr, tf } from "@/lib/i18n"
import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, Pill, Row, RowList } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { Chips } from "@/components/ui/segmented"
import { todayIso } from "@/lib/domain/dates"
import { searchProducts } from "@/lib/store/search"
import { withDetail } from "@/components/product-subtitle"
import { priceText, stockCountText, stockWithUnit } from "@/lib/store/pack-text"
import { expiringSoonCount, isLowStock, lowStockProducts, nearestExpiryDays, sellableStock } from "@/lib/store/selectors"
import { toBanglaDigits } from "@/lib/format/bn"
import { groupByFamily } from "@/lib/store/variants"
import { DEMO_ENABLED } from "@/lib/config"

type Filter = "all" | "low" | "expiry"

export default function StockPage() {
  const { db, update } = useDb()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  // খোলা ফ্যামিলি (ভ্যারিয়েন্টের গ্রুপ); খোঁজার সময় সব খোলা দেখায়
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  const groups = useMemo(() => groupByFamily(rows), [rows])
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  return (
    <AppShell
      title={tr("স্টক")}
      nav
      action={
        <LinkButton href="/stock/in" className="min-h-10 px-3 text-sm">
          <Icon name="plus" size={18} /> {tr("স্টক যোগ")}
        </LinkButton>
      }
    >
      <SearchBox id="stock-search" label={tr("স্টকে পণ্য খুঁজুন")} placeholder={tr("নাম বা বারকোড")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: tr("সব") },
          { value: "low", label: tf("স্টক কম · {p0}", { p0: (toBanglaDigits(lowCount)) }) },
          { value: "expiry", label: tf("মেয়াদ কাছে · {p0}", { p0: (toBanglaDigits(soonCount)) }) },
        ]}
      />

      {db.products.length === 0 ? (
        <Card className="space-y-3 px-4 py-6 text-center">
          <p className="font-medium">{tr("এখনো কোনো পণ্য নেই")}</p>
          <p className="text-sm text-muted">{tr("নতুন পণ্য যোগ করুন, অথবা CSV ফাইল থেকে একসাথে আনুন।")}</p>
          <div className="flex flex-col gap-2">
            <LinkButton href="/products/new">{tr("নতুন পণ্য যোগ করুন")}</LinkButton>
            <LinkButton href="/products/import" variant="secondary">
              {tr("CSV থেকে আনুন")}
            </LinkButton>
            {DEMO_ENABLED ? (
              <Button variant="ghost" onClick={() => import("@/lib/store/seed").then((m) => update((d) => m.withDemoData(d, new Date())))}>
                {tr("নমুনা তথ্য দিয়ে দেখুন")}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("এই ফিল্টারে কোনো পণ্য নেই")}</Card>
      ) : (
        <RowList>
          {groups.map((g) => {
            const productRow = (p: (typeof rows)[number], asVariant: boolean) => {
              const sellable = sellableStock(db, p.id, today)
              const days = nearestExpiryDays(db, p.id, today)
              const low = sellable < p.minStock
              return (
                <Row
                  key={p.id}
                  href={`/products/detail?id=${p.id}`}
                  title={asVariant ? (p.variant ?? p.name) : p.name}
                  subtitle={withDetail(p, tf("{p0} · স্টক {p1}", { p0: priceText(p), p1: stockCountText(p, sellable) }))}
                  className={asVariant ? "bg-canvas/60 pl-8" : undefined}
                  right={
                    days != null && days <= 30 ? <Pill tone="warn">{tr("মেয়াদ")} {toBanglaDigits(days)} {tr("দিন")}</Pill> : low ? <Pill tone="danger">{tr("স্টক কম")}</Pill> : undefined
                  }
                  chevron
                />
              )
            }
            const first = g.items[0]
            if (g.items.length === 1 && first) return productRow(first, false)
            const open = query.trim() !== "" || expanded.has(g.key)
            const total = g.items.reduce((n, p) => n + sellableStock(db, p.id, today), 0)
            const anyLow = g.items.some((p) => sellableStock(db, p.id, today) < p.minStock)
            return (
              <div key={g.key}>
                <Row
                  onClick={() => toggle(g.key)}
                  title={g.title}
                  subtitle={tf("{p0}টি ভ্যারিয়েন্ট · মোট স্টক {p1}", { p0: toBanglaDigits(g.items.length), p1: stockWithUnit(g.items[0] ?? {}, total) })}
                  right={anyLow ? <Pill tone="danger">{tr("স্টক কম")}</Pill> : undefined}
                  chevron
                />
                {open ? <div className="divide-y divide-line border-t border-line">{g.items.map((p) => productRow(p, true))}</div> : null}
              </div>
            )
          })}
        </RowList>
      )}

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/products/new" variant="secondary">
          {tr("নতুন পণ্য")}
        </LinkButton>
        <LinkButton href="/products/open" variant="secondary">
          {tr("খোলা পণ্য")}
        </LinkButton>
      </div>
      <LinkButton href="/products/import" variant="ghost" full>
        {tr("CSV থেকে পণ্য আনুন")}
      </LinkButton>
    </AppShell>
  )
}
