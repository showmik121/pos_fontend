"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Card, Pill, Row, RowList } from "@/components/ui/card"
import { SearchBox } from "@/components/ui/inputs"
import { LinkButton } from "@/components/ui/button"
import { todayIso } from "@/lib/domain/dates"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { addToCart } from "@/lib/store/actions"
import { searchProducts } from "@/lib/store/search"
import { sellableStock } from "@/lib/store/selectors"

export default function SellSearchPage() {
  const { db, update } = useDb()
  const router = useRouter()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const results = useMemo(() => searchProducts(db, query), [db, query])

  return (
    <AppShell title="পণ্য খুঁজুন" backHref="/sell">
      <SearchBox id="sell-search" label="পণ্য খুঁজুন" placeholder="নাম বা বারকোড লিখুন" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      {db.products.length === 0 ? (
        <Card className="space-y-3 px-4 py-6 text-center">
          <p className="font-medium">এখনো কোনো পণ্য নেই</p>
          <LinkButton href="/products/new">নতুন পণ্য যোগ করুন</LinkButton>
        </Card>
      ) : results.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">কিছু পাওয়া যায়নি</Card>
      ) : (
        <RowList>
          {results.map((p) => {
            const sellable = sellableStock(db, p.id, today)
            return (
              <Row
                key={p.id}
                title={p.name}
                subtitle={`${formatTaka(p.pricePoisha)} · স্টক ${formatCount(sellable)}`}
                right={sellable <= 0 ? <Pill tone="danger">স্টক নেই</Pill> : undefined}
                onClick={
                  sellable <= 0
                    ? undefined
                    : () => {
                        update((d) => ({ ...d, draft: addToCart(d.draft, p.id, 1) }))
                        router.push("/sell")
                      }
                }
              />
            )
          })}
        </RowList>
      )}
    </AppShell>
  )
}
