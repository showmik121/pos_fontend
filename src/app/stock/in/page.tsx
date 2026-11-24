"use client"

import { tr, tf } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { useReadOnlyShop } from "@/components/tenant-notice"
import { Scanner } from "@/components/scanner"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, Row, RowList } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { Segmented } from "@/components/ui/segmented"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { parseMonthYear } from "@/lib/domain/dates"
import { formatExpiryInput, normalizeExpiryInput } from "@/lib/domain/expiry-input"
import { addToQty } from "@/lib/domain/qty-input"
import { DomainError, domainMessage } from "@/lib/domain/errors"
import { formatCount, formatTaka, parseTaka, takaInputValue } from "@/lib/domain/money"
import type { StockUnit } from "@/lib/domain/units"
import { toAsciiDigits } from "@/lib/format/bn"
import { stockIn } from "@/lib/store/actions"
import { searchProducts } from "@/lib/store/search"
import { newProductFromScanHref } from "@/lib/store/flow"
import { findByBarcode, findProduct, totalStock } from "@/lib/store/selectors"

/** পরিমাণ দ্রুত বাড়ানোর বোতাম */
const QTY_STEPS = [1, 5, 10, 20, 50] as const

const UNITS = [
  { value: "piece", label: "পিস" },
  { value: "carton", label: "কার্টন" },
] as const

function StockInForm() {
  const params = useSearchParams()
  const router = useRouter()
  const { db, update, ready } = useDb()
  // শুধু-দেখা মোডে নতুন স্টক-জমা বন্ধ; ব্যানার কারণ বলে
  const readOnlyShop = useReadOnlyShop()
  const { isPharmacy } = useSessionInfo()
  const [productId, setProductId] = useState<string | null>(params.get("product"))
  const [query, setQuery] = useState("")
  // ?scan=1 হলে পাতা খুলেই ক্যামেরা চালু (একটানা অনেক পণ্যের স্টক তোলার সময় সুবিধা)
  const [scanning, setScanning] = useState(params.get("scan") === "1")
  const [scanMiss, setScanMiss] = useState<string | null>(null)
  // সর্বশেষ যোগ হওয়া পণ্য: "সেভ করে পরের পণ্য"-র পর নিশ্চিতকরণ দেখায়
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const [unit, setUnit] = useState<StockUnit>("piece")
  const [qty, setQty] = useState("")
  const [batchNo, setBatchNo] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cost, setCost] = useState("")
  const [price, setPrice] = useState("")
  const [error, setError] = useState<string | null>(null)

  const product = productId ? findProduct(db, productId) : undefined
  const results = useMemo(() => searchProducts(db, query), [db, query])

  // পণ্য বাছা হলে তার বর্তমান দাম আগে থেকে বসে যায়
  useEffect(() => {
    if (!ready || !productId) return
    const p = findProduct(db, productId)
    if (p) {
      setCost(takaInputValue(p.costPoisha))
      setPrice(takaInputValue(p.pricePoisha))
    }
    // শুধু পণ্য বদলালে চলবে; db বদলালে ব্যবহারকারীর লেখা মুছে যাবে
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, productId])

  const choose = (id: string) => setProductId(id)

  if (!product) {
    return (
      <AppShell title={tr("স্টক যোগ")} backHref="/stock">
        {lastAdded ? <Banner tone="info">{lastAdded}</Banner> : null}
        <Button full onClick={() => setScanning(true)}>
          <Icon name="scan" /> {tr("বারকোড স্ক্যান করুন")}
        </Button>
        <SearchBox id="si-search" label={tr("পণ্য খুঁজুন")} placeholder={tr("কোন পণ্যের স্টক যোগ করবেন?")} value={query} onChange={(e) => setQuery(e.target.value)} />
        {scanMiss ? (
          <Banner tone="warn">
            <div className="space-y-2">
              <div>{tr("এই বারকোডে (")}{scanMiss}{tr(") কোনো পণ্য নেই।")}</div>
              <Button full onClick={() => router.push(newProductFromScanHref(scanMiss))}>
                <Icon name="plus" /> {tr("নতুন পণ্য হিসেবে যোগ করুন")}
              </Button>
            </div>
          </Banner>
        ) : null}
        <Button variant="secondary" full onClick={() => router.push("/products/new?next=stock")}>
          <Icon name="plus" /> {tr("নতুন পণ্য (তালিকায় নেই)")}
        </Button>
        {results.length === 0 ? (
          <Card className="px-4 py-6 text-center text-muted">{tr("পণ্য পাওয়া যায়নি")}</Card>
        ) : (
          <RowList>
            {results.map((p) => (
              <Row key={p.id} title={p.name} subtitle={tf("স্টক {p0}", { p0: (formatCount(totalStock(db, p.id))) })} onClick={() => choose(p.id)} chevron />
            ))}
          </RowList>
        )}
        <Scanner
          open={scanning}
          onClose={() => setScanning(false)}
          onCode={(code) => {
            setScanning(false)
            const hit = findByBarcode(db, code)
            if (hit) {
              setScanMiss(null)
              choose(hit.product.id)
            } else setScanMiss(code)
          }}
        />
      </AppShell>
    )
  }

  /** next = true হলে সেভের পর পরের পণ্যের জন্য ক্যামেরা খোলে; নইলে পণ্যের পাতায় যায় */
  const submit = (next: boolean) => {
    if (!product) return
    setError(null)
    const q = Number(toAsciiDigits(qty))
    if (!Number.isInteger(q) || q < 1) return setError(tr("পরিমাণ ১ বা তার বেশি পূর্ণসংখ্যা দিন"))
    const costPoisha = cost.trim() ? parseTaka(cost) : 0
    const pricePoisha = price.trim() ? parseTaka(price) : null
    if (costPoisha == null || (price.trim() && pricePoisha == null)) return setError(tr("টাকার পরিমাণ সঠিক নয়"))
    let expiryDate: string | null = null
    if (expiry.trim()) {
      expiryDate = parseMonthYear(normalizeExpiryInput(expiry))
      if (!expiryDate) return setError(tr("মেয়াদ মাস/বছর আকারে দিন (যেমন ০৬/২০২৭)"))
    }
    try {
      update((d) => stockIn(d, { productId: product.id, qty: q, unit, batchNo, expiryDate, costPoisha, pricePoisha, requireBatchAndExpiry: isPharmacy }, new Date()))
    } catch (err) {
      return setError(err instanceof DomainError ? err.message : domainMessage(err))
    }
    if (!next) return router.replace(`/products/detail?id=${product.id}`)
    setLastAdded(tf("✓ {p0}: {p1} যোগ হলো। পরের পণ্য বাছুন।", { p0: product.name, p1: `${formatCount(q)} ${unit === "carton" ? tr("কার্টন") : tr("পিস")}` }))
    setProductId(null)
    setQty("")
    setBatchNo("")
    setExpiry("")
    setScanMiss(null)
    setQuery("")
    setScanning(true)
  }

  const perCarton = product.cartonSize > 1
  return (
    <AppShell title={tr("স্টক যোগ")} backHref="/stock" footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => submit(true)} disabled={readOnlyShop}>
            {tr("সেভ করে পরের পণ্য")}
          </Button>
          <Button className="flex-1" onClick={() => submit(false)} disabled={readOnlyShop}>
            {tr("স্টকে যোগ করুন")}
          </Button>
        </div>
      }>
      <Card className="px-4 py-3">
        <div className="font-medium">{product.name}</div>
        <div className="text-[13px] text-muted">
          {tr("এখন স্টক")} {formatCount(totalStock(db, product.id))} {tr("পিস · বিক্রয়মূল্য")} {formatTaka(product.pricePoisha)}
        </div>
        <button type="button" onClick={() => setProductId(null)} className="mt-1 min-h-11 text-sm text-brand-dark underline">
          {tr("অন্য পণ্য বাছুন")}
        </button>
      </Card>

      {perCarton ? (
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{tr("কীভাবে গুনছেন")}</span>
          <Segmented label={tr("একক")} options={UNITS} value={unit} onChange={setUnit} />
        </div>
      ) : null}
      <Field
        id="si-qty"
        label={unit === "carton" ? tf("কার্টন (১ কার্টন = {p0} পিস)", { p0: (formatCount(product.cartonSize)) }) : tr("পরিমাণ (পিস)")}
        inputMode="numeric"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        autoFocus
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr("দ্রুত পরিমাণ যোগ")}>
        {QTY_STEPS.map((n) => (
          <Button key={n} variant="secondary" className="min-w-14" onClick={() => setQty((q) => addToQty(q, n))}>
            +{formatCount(n)}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="si-batch" label={isPharmacy ? tr("ব্যাচ নম্বর") : tr("ব্যাচ (ঐচ্ছিক)")} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
        <Field id="si-expiry" label={isPharmacy ? tr("মেয়াদ (মাস/বছর)") : tr("মেয়াদ (ঐচ্ছিক)")} placeholder={tr("০৬/২০২৭")} inputMode="numeric" value={expiry} onChange={(e) => setExpiry(formatExpiryInput(e.target.value))} onBlur={() => setExpiry((x) => normalizeExpiryInput(x))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="si-cost" label={unit === "carton" ? tr("ক্রয়মূল্য (প্রতি কার্টন)") : tr("ক্রয়মূল্য (প্রতি পিস)")} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Field id="si-price" label={tr("বিক্রয়মূল্য (প্রতি পিস)")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </AppShell>
  )
}

export default function StockInPage() {
  return (
    <Suspense fallback={<Splash />}>
      <StockInForm />
    </Suspense>
  )
}
