"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Card, Row, RowList } from "@/components/ui/card"
import { Chips } from "@/components/ui/segmented"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { todayIso } from "@/lib/domain/dates"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { rangeStart, topProducts } from "@/lib/store/selectors"

type Range = "1" | "7" | "30"

export default function TopProductsPage() {
  const { db } = useDb()
  const { isOwner } = useSessionInfo()
  const today = todayIso()
  const [range, setRange] = useState<Range>("7")
  const rows = topProducts(db, rangeStart(today, Number(range)), today, 10)

  return (
    <AppShell title="সেরা বিক্রি" backHref="/reports">
      {!isOwner ? (
        <Banner tone="warn">রিপোর্ট শুধু মালিক দেখতে পারেন।</Banner>
      ) : (
        <>
          <Chips
            value={range}
            onChange={setRange}
            options={[
              { value: "1", label: "আজ" },
              { value: "7", label: "৭ দিন" },
              { value: "30", label: "৩০ দিন" },
            ]}
          />
          {rows.length === 0 ? (
            <Card className="px-4 py-6 text-center text-muted">এই সময়ে কোনো বিক্রি নেই।</Card>
          ) : (
            <RowList>
              {rows.map((r, i) => (
                <Row key={r.productId} title={`${toBanglaDigits(i + 1)}. ${r.name}`} subtitle={`${formatCount(r.qty)} পিস বিক্রি`} right={<span className="font-semibold">{formatTaka(r.revenue)}</span>} />
              ))}
            </RowList>
          )}
        </>
      )}
    </AppShell>
  )
}
