"use client"

import { tr, tf } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Card, Pill, Row, RowList } from "@/components/ui/card"
import { SearchBox } from "@/components/ui/inputs"
import { Sheet } from "@/components/ui/sheet"
import { Field } from "@/components/ui/field"
import { PackQuickAdd } from "@/components/pack-quick-add"
import { hasStrips, stockCountText } from "@/lib/store/pack-text"
import { toAsciiDigits } from "@/lib/format/bn"
import type { Product } from "@/lib/store/types"
import { Button, LinkButton } from "@/components/ui/button"
import { todayIso } from "@/lib/domain/dates"
import { formatTaka } from "@/lib/domain/money"
import { addToCart } from "@/lib/store/actions"
import { searchProducts } from "@/lib/store/search"
import { withDetail } from "@/components/product-subtitle"
import { sellableStock } from "@/lib/store/selectors"
import { groupByFamily } from "@/lib/store/variants"
import { formatCount } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"

export default function SellSearchPage() {
  const { db, update } = useDb()
  const router = useRouter()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const [picking, setPicking] = useState<Product | null>(null)
  const [customQty, setCustomQty] = useState("")
  const results = useMemo(() => searchProducts(db, query), [db, query])
  const groups = useMemo(() => groupByFamily(results), [results])
  // ভ্যারিয়েন্টের গ্রুপ: খোঁজার সময় খোলা (কাউন্টারে এক ট্যাপে সাইজ বাছতে), খালি খোঁজে গোটানো
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const add = (product: Product, qty: number) => {
    update((d) => ({ ...d, draft: addToCart(d.draft, product.id, qty) }))
    router.push("/sell")
  }
  const customPieces = Number(toAsciiDigits(customQty))
  const customOk = Number.isInteger(customPieces) && customPieces >= 1

  return (
    <AppShell title={tr("পণ্য খুঁজুন")} backHref="/sell">
      <SearchBox id="sell-search" label={tr("পণ্য খুঁজুন")} placeholder={tr("নাম বা বারকোড লিখুন")} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      {db.products.length === 0 ? (
        <Card className="space-y-3 px-4 py-6 text-center">
          <p className="font-medium">{tr("এখনো কোনো পণ্য নেই")}</p>
          <LinkButton href="/products/new">{tr("নতুন পণ্য যোগ করুন")}</LinkButton>
        </Card>
      ) : results.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("কিছু পাওয়া যায়নি")}</Card>
      ) : (
        <RowList>
          {groups.map((g) => {
            const productRow = (p: Product, asVariant: boolean) => {
              const sellable = sellableStock(db, p.id, today)
              return (
                <Row
                  key={p.id}
                  title={asVariant ? (p.variant ?? p.name) : p.name}
                  subtitle={withDetail(p, tf("{p0} · স্টক {p1}", { p0: (formatTaka(p.pricePoisha)), p1: stockCountText(p, sellable) }))}
                  className={asVariant ? "bg-canvas/60 pl-8" : undefined}
                  right={sellable <= 0 ? <Pill tone="danger">{tr("স্টক নেই")}</Pill> : undefined}
                  onClick={
                    sellable <= 0
                      ? undefined
                      : () => {
                          if (hasStrips(p)) {
                            setCustomQty("")
                            setPicking(p)
                          } else add(p, 1)
                        }
                  }
                />
              )
            }
            const first = g.items[0]
            if (g.items.length === 1 && first) return productRow(first, false)
            const open = query.trim() !== "" || expanded.has(g.key)
            const total = g.items.reduce((n, p) => n + sellableStock(db, p.id, today), 0)
            return (
              <div key={g.key}>
                <Row
                  onClick={query.trim() !== "" ? undefined : () => toggle(g.key)}
                  title={g.title}
                  subtitle={tf("{p0}টি ভ্যারিয়েন্ট · মোট স্টক {p1} পিস", { p0: toBanglaDigits(g.items.length), p1: formatCount(total) })}
                  chevron={query.trim() === ""}
                />
                {open ? <div className="divide-y divide-line border-t border-line">{g.items.map((p) => productRow(p, true))}</div> : null}
              </div>
            )
          })}
        </RowList>
      )}
      <Sheet open={picking != null} onClose={() => setPicking(null)} label={tr("কতটুকু যোগ করবেন")}>
        <h2 className="text-lg font-bold">{picking?.name}</h2>
        <p className="text-muted">{tr("পুরো পাতা, নাকি পাতা কেটে কয়েক পিস?")}</p>
        {picking ? <PackQuickAdd product={picking} includeOne onAdd={(q) => add(picking, q)} /> : null}
        <Field id="pick-qty" label={tr("অন্য সংখ্যা (পিস)")} inputMode="numeric" value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
        <Button full disabled={!customOk} onClick={() => picking && customOk && add(picking, customPieces)}>
          {tr("বিলে যোগ করুন")}
        </Button>
      </Sheet>
    </AppShell>
  )
}
