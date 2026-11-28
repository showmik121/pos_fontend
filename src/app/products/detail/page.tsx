"use client"

import { tr, tf } from "@/lib/i18n"
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
import { hasStrips, packText, priceText, stockWithUnit } from "@/lib/store/pack-text"
import { toBanglaDigits } from "@/lib/format/bn"
import { addBarcode } from "@/lib/store/actions"
import { siblingsOf } from "@/lib/store/variants"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { batchesOf, findByBarcode, findProduct, sellableStock, totalStock } from "@/lib/store/selectors"
import { DOSAGE_FORMS, UNIT_LABELS } from "@/lib/store/types"

function ProductDetail() {
  const id = useSearchParams().get("id")
  const { db, update } = useDb()
  const { isPharmacy } = useSessionInfo()
  const today = todayIso()
  const [scanning, setScanning] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [pack, setPack] = useState<"piece" | "strip" | "carton">("piece")
  const [error, setError] = useState<string | null>(null)

  const product = id ? findProduct(db, id) : undefined
  if (!product) {
    return (
      <AppShell title={tr("পণ্য")} backHref="/stock">
        <Banner tone="warn">{tr("পণ্যটি পাওয়া যায়নি।")}</Banner>
      </AppShell>
    )
  }

  const total = totalStock(db, product.id)
  const sellable = sellableStock(db, product.id, today)
  const batches = batchesOf(db, product.id).filter((b) => b.qtyRemaining > 0)
  const firstSellableId = sellableBatches(batches, today)[0]?.id
  const packed = hasStrips(product) || product.cartonSize > 1
  const low = sellable < product.minStock
  const siblings = siblingsOf(db, product)

  const onScanned = (code: string) => {
    setScanning(false)
    const hit = findByBarcode(db, code)
    if (hit) {
      setError(hit.product.id === product.id ? tr("এই বারকোড এই পণ্যেই আগে থেকে আছে।") : tf("এই বারকোড আগে থেকেই \"{p0}\"-এ আছে।", { p0: (hit.product.name) }))
      return
    }
    setError(null)
    setPack("piece")
    setPending(code)
  }

  const saveBarcode = () => {
    if (!pending) return
    try {
      update((d) => addBarcode(d, product.id, pending, pack === "carton" ? product.cartonSize : pack === "strip" ? (product.stripSize ?? 1) : 1))
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
          {tr("সম্পাদনা")}
        </LinkButton>
      }
    >
      <Card>
        <div className="divide-y divide-line">
          {product.variant ? <KeyValue label={tr("ভ্যারিয়েন্ট")} value={product.variant} /> : null}
          <KeyValue label={tr("বিক্রয়মূল্য")} value={priceText(product)} />
          <KeyValue label={tr("ক্রয়মূল্য")} value={priceText(product, product.costPoisha)} />
          <KeyValue label={tr("একক")} value={UNIT_LABELS[product.unit]} />
          {hasStrips(product) ? <KeyValue label={tr("১ পাতায়")} value={tf("{p0} পিস", { p0: formatCount(product.stripSize ?? 1) })} /> : null}
          {hasStrips(product) ? <KeyValue label={tr("প্রতি পাতার দাম")} value={formatTaka(product.pricePoisha * (product.stripSize ?? 1))} /> : null}
          {product.generic ? <KeyValue label={tr("জেনেরিক নাম")} value={product.generic} /> : null}
          {product.strength ? <KeyValue label={tr("শক্তি")} value={product.strength} /> : null}
          {product.form ? <KeyValue label={tr("ধরন")} value={tr(DOSAGE_FORMS[product.form])} /> : null}
          {product.company ? <KeyValue label={tr("কোম্পানি")} value={product.company} /> : null}
          {product.category ? <KeyValue label={tr("ক্যাটেগরি")} value={product.category} /> : null}
        </div>
      </Card>

      <Card className="space-y-1 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{tr("বিক্রি করা যাবে")}</span>
          {low ? <Pill tone={sellable === 0 ? "danger" : "warn"}>{sellable === 0 ? tr("স্টক শেষ") : tr("স্টক কম")}</Pill> : null}
        </div>
        <div className="text-[28px] font-bold leading-tight">{stockWithUnit(product, sellable)}</div>
        <div className="text-sm text-muted">
          {tr("মোট")} {stockWithUnit(product, total)}{packed ? ` (${packText(total, product)})` : ""} {tr("· সর্বনিম্ন")} {stockWithUnit(product, product.minStock)}
        </div>
      </Card>

      <LinkButton href={`/stock/in?product=${product.id}`} full>
        <Icon name="plus" /> {tr("স্টক যোগ করুন")}
      </LinkButton>
      {!isPharmacy ? (
        <LinkButton href={`/products/new?from=${product.id}`} variant="secondary" full>
          <Icon name="plus" /> {tr("আরেকটি ভ্যারিয়েন্ট যোগ করুন")}
        </LinkButton>
      ) : null}
      {siblings.length > 0 ? (
        <>
          <SectionTitle>{tf("{p0}-এর অন্য ভ্যারিয়েন্ট", { p0: product.family ?? product.name })}</SectionTitle>
          <RowList>
            {siblings.map((x) => (
              <Row key={x.id} href={`/products/detail?id=${x.id}`} title={x.variant ?? x.name} subtitle={tf("{p0} · স্টক {p1}", { p0: priceText(x), p1: stockWithUnit(x, sellableStock(db, x.id, today)) })} chevron />
            ))}
          </RowList>
        </>
      ) : null}

      <SectionTitle>{tr("ব্যাচ")}</SectionTitle>
      {batches.length === 0 ? (
        <Card className="px-4 py-5 text-center text-muted">{tr("কোনো ব্যাচে স্টক নেই।")}</Card>
      ) : (
        <RowList>
          {batches.map((b) => {
            const cls = classifyExpiry(b.expiryDate, today)
            const days = b.expiryDate ? daysUntil(b.expiryDate, today) : null
            return (
              <Row
                key={b.id}
                title={b.batchNo ? tf("ব্যাচ {p0}", { p0: (b.batchNo) }) : tr("ব্যাচ নম্বর নেই")}
                subtitle={tf("{p0} · {p1}", { p0: stockWithUnit(product, b.qtyRemaining), p1: (b.expiryDate ? formatDateBn(b.expiryDate) : tr("মেয়াদ নেই")) })}
                right={
                  cls === "expired" ? (
                    <Pill tone="danger">{tr("মেয়াদোত্তীর্ণ")}</Pill>
                  ) : b.id === firstSellableId ? (
                    <Pill tone="brand">{tr("আগে বিক্রি হবে")}</Pill>
                  ) : days != null && days <= 30 ? (
                    <Pill tone="warn">{toBanglaDigits(days)} {tr("দিন")}</Pill>
                  ) : undefined
                }
              />
            )
          })}
        </RowList>
      )}

      <SectionTitle>{tr("বারকোড")}</SectionTitle>
      {product.barcodes.length === 0 ? (
        <Card className="px-4 py-4 text-center text-muted">{product.open ? tr("এটি খোলা পণ্য — বারকোড ছাড়াই বিক্রি হয়।") : tr("কোনো বারকোড নেই।")}</Card>
      ) : (
        <RowList>
          {product.barcodes.map((b) => (
            <Row key={b.code} title={toBanglaDigits(b.code)} subtitle={b.packSize === 1 ? tr("১ পিস") : b.packSize === product.stripSize ? tf("পাতা · {p0} পিস", { p0: formatCount(b.packSize) }) : tf(hasStrips(product) ? "বক্স · {p0} পিস" : "কার্টন · {p0} পিস", { p0: formatCount(b.packSize) })} />
          ))}
        </RowList>
      )}
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <Button variant="secondary" full onClick={() => setScanning(true)}>
        <Icon name="barcode" /> {tr("বারকোড যোগ করুন")}
      </Button>

      <Scanner open={scanning} onClose={() => setScanning(false)} onCode={onScanned} title={tr("নতুন বারকোড স্ক্যান")} />

      <Sheet open={pending != null} onClose={() => setPending(null)} label={tr("বারকোডের ধরন")}>
        <h2 className="text-lg font-bold">{tr("এই বারকোড কিসের?")}</h2>
        <p className="text-muted">{pending ? toBanglaDigits(pending) : ""}</p>
        <Segmented
          label={tr("বারকোডের ধরন")}
          value={pack}
          onChange={setPack}
          options={[
            { value: "piece" as const, label: tr("১ পিস") },
            ...(hasStrips(product) ? [{ value: "strip" as const, label: tf("পাতা ({p0} পিস)", { p0: formatCount(product.stripSize ?? 1) }) }] : []),
            ...(product.cartonSize > 1 ? [{ value: "carton" as const, label: tf(hasStrips(product) ? "বক্স ({p0} পিস)" : "কার্টন ({p0} পিস)", { p0: formatCount(product.cartonSize) }) }] : []),
          ]}
        />
        <p className="text-sm text-muted">{tr("কার্টনের বারকোড স্ক্যান করলে বিলে একবারে এতগুলো পিস যোগ হবে।")}</p>
        <Button full onClick={saveBarcode}>
          {tr("বারকোড সেভ করুন")}
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
