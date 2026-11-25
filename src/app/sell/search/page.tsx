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

export default function SellSearchPage() {
  const { db, update } = useDb()
  const router = useRouter()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const [picking, setPicking] = useState<Product | null>(null)
  const [customQty, setCustomQty] = useState("")
  const results = useMemo(() => searchProducts(db, query), [db, query])

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
          {results.map((p) => {
            const sellable = sellableStock(db, p.id, today)
            return (
              <Row
                key={p.id}
                title={p.name}
                subtitle={withDetail(p, tf("{p0} · স্টক {p1}", { p0: (formatTaka(p.pricePoisha)), p1: stockCountText(p, sellable) }))}
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
