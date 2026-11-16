"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Scanner } from "@/components/scanner"
import { Banner } from "@/components/ui/banner"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, KeyValue, Pill, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { Segmented } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { formatDateBn, todayIso } from "@/lib/domain/dates"
import { classifyExpiry, daysUntil } from "@/lib/domain/expiry"
import { sellableBatches } from "@/lib/domain/fifo"
import { domainMessage } from "@/lib/domain/errors"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { splitCartons } from "@/lib/domain/units"
import { toBanglaDigits } from "@/lib/format/bn"
import { addBarcode } from "@/lib/store/actions"
import { batchesOf, findByBarcode, findProduct, sellableStock, totalStock } from "@/lib/store/selectors"
import { UNIT_LABELS } from "@/lib/store/types"

function ProductDetail() {
  const id = useSearchParams().get("id")
  const { db, update } = useDb()
  const today = todayIso()
  const [scanning, setScanning] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [pack, setPack] = useState<"piece" | "carton">("piece")
  const [error, setError] = useState<string | null>(null)

  const product = id ? findProduct(db, id) : undefined
  if (!product) {
    return (
      <AppShell title="পণ্য" backHref="/stock">
        <Banner tone="warn">পণ্যটি পাওয়া যায়নি।</Banner>
      </AppShell>
    )
  }

  const total = totalStock(db, product.id)
  const sellable = sellableStock(db, product.id, today)
  const batches = batchesOf(db, product.id).filter((b) => b.qtyRemaining > 0)
  const firstSellableId = sellableBatches(batches, today)[0]?.id
  const split = product.cartonSize > 1 ? splitCartons(total, product.cartonSize) : null
  const low = sellable < product.minStock

  const onScanned = (code: string) => {
    setScanning(false)
    const hit = findByBarcode(db, code)
    if (hit) {
      setError(hit.product.id === product.id ? "এই বারকোড এই পণ্যেই আগে থেকে আছে।" : `এই বারকোড আগে থেকেই "${hit.product.name}"-এ আছে।`)
      return
    }
    setError(null)
    setPack("piece")
    setPending(code)
  }

  const saveBarcode = () => {
    if (!pending) return
    try {
      update((d) => addBarcode(d, product.id, pending, pack === "carton" ? product.cartonSize : 1))
      setPending(null)
    } catch (err) {
      setPending(null)
      setError(domainMessage(err))
    }
  }

  return (
    <AppShell
      title={product.name}
      backHref="/stock"
      action={
        <LinkButton href={`/products/edit?id=${product.id}`} variant="ghost" className="min-h-10 px-3 text-sm">
          সম্পাদনা
        </LinkButton>
      }
    >
      <Card>
        <div className="divide-y divide-line">
          <KeyValue label="বিক্রয়মূল্য" value={formatTaka(product.pricePoisha)} />
          <KeyValue label="ক্রয়মূল্য" value={formatTaka(product.costPoisha)} />
          <KeyValue label="একক" value={UNIT_LABELS[product.unit]} />
          {product.category ? <KeyValue label="ক্যাটেগরি" value={product.category} /> : null}
        </div>
      </Card>

      <Card className="space-y-1 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">বিক্রি করা যাবে</span>
          {low ? <Pill tone={sellable === 0 ? "danger" : "warn"}>{sellable === 0 ? "স্টক শেষ" : "স্টক কম"}</Pill> : null}
        </div>
        <div className="text-[28px] font-bold leading-tight">{formatCount(sellable)} পিস</div>
        <div className="text-sm text-muted">
          মোট {formatCount(total)} পিস{split ? ` (${formatCount(split.cartons)} কার্টন ${formatCount(split.pieces)} পিস)` : ""} · সর্বনিম্ন {formatCount(product.minStock)}
        </div>
      </Card>

      <LinkButton href={`/stock/in?product=${product.id}`} full>
        <Icon name="plus" /> স্টক যোগ করুন
      </LinkButton>

      <SectionTitle>ব্যাচ</SectionTitle>
      {batches.length === 0 ? (
        <Card className="px-4 py-5 text-center text-muted">কোনো ব্যাচে স্টক নেই।</Card>
      ) : (
        <RowList>
          {batches.map((b) => {
            const cls = classifyExpiry(b.expiryDate, today)
            const days = b.expiryDate ? daysUntil(b.expiryDate, today) : null
            return (
              <Row
                key={b.id}
                title={b.batchNo ? `ব্যাচ ${b.batchNo}` : "ব্যাচ নম্বর নেই"}
                subtitle={`${formatCount(b.qtyRemaining)} পিস · ${b.expiryDate ? formatDateBn(b.expiryDate) : "মেয়াদ নেই"}`}
                right={
                  cls === "expired" ? (
                    <Pill tone="danger">মেয়াদোত্তীর্ণ</Pill>
                  ) : b.id === firstSellableId ? (
                    <Pill tone="brand">আগে বিক্রি হবে</Pill>
                  ) : days != null && days <= 30 ? (
                    <Pill tone="warn">{toBanglaDigits(days)} দিন</Pill>
                  ) : undefined
                }
              />
            )
          })}
        </RowList>
      )}

      <SectionTitle>বারকোড</SectionTitle>
      {product.barcodes.length === 0 ? (
        <Card className="px-4 py-4 text-center text-muted">{product.open ? "এটি খোলা পণ্য — বারকোড ছাড়াই বিক্রি হয়।" : "কোনো বারকোড নেই।"}</Card>
      ) : (
        <RowList>
          {product.barcodes.map((b) => (
            <Row key={b.code} title={toBanglaDigits(b.code)} subtitle={b.packSize === 1 ? "১ পিস" : `কার্টন · ${formatCount(b.packSize)} পিস`} />
          ))}
        </RowList>
      )}
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <Button variant="secondary" full onClick={() => setScanning(true)}>
        <Icon name="barcode" /> বারকোড যোগ করুন
      </Button>

      <Scanner open={scanning} onClose={() => setScanning(false)} onCode={onScanned} title="নতুন বারকোড স্ক্যান" />

      <Sheet open={pending != null} onClose={() => setPending(null)} label="বারকোডের ধরন">
        <h2 className="text-lg font-bold">এই বারকোড কিসের?</h2>
        <p className="text-muted">{pending ? toBanglaDigits(pending) : ""}</p>
        <Segmented
          label="বারকোডের ধরন"
          value={pack}
          onChange={setPack}
          options={[
            { value: "piece" as const, label: "১ পিস" },
            ...(product.cartonSize > 1 ? [{ value: "carton" as const, label: `কার্টন (${formatCount(product.cartonSize)} পিস)` }] : []),
          ]}
        />
        <p className="text-sm text-muted">কার্টনের বারকোড স্ক্যান করলে বিলে একবারে এতগুলো পিস যোগ হবে।</p>
        <Button full onClick={saveBarcode}>
          বারকোড সেভ করুন
        </Button>
      </Sheet>
    </AppShell>
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ProductDetail />
    </Suspense>
  )
}
