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
import { normalizeExpiryInput } from "@/lib/domain/expiry-input"
import { ExpiryField } from "@/components/expiry-field"
import { addToQty } from "@/lib/domain/qty-input"
import { toPieces } from "@/lib/domain/units"
import type { Product } from "@/lib/store/types"
import { formatMeasureQty, measureInputValue, measureName, parseMeasureQty, perMeasurePoisha, perPiecePoishaFromMeasure } from "@/lib/domain/measure"
import { DomainError, domainMessage } from "@/lib/domain/errors"
import { formatCount, formatTaka, parseTaka, takaInputValue } from "@/lib/domain/money"
import { hasStrips, packText } from "@/lib/store/pack-text"
import { toAsciiDigits } from "@/lib/format/bn"
import { stockIn } from "@/lib/store/actions"
import { searchProducts } from "@/lib/store/search"
import { withDetail } from "@/components/product-subtitle"
import { newProductFromScanHref } from "@/lib/store/flow"
import { findByBarcode, findProduct, totalStock } from "@/lib/store/selectors"

/** পরিমাণ দ্রুত বাড়ানোর বোতাম */
const QTY_STEPS = [1, 5, 10, 20, 50] as const
/** কেজি/লিটারে পরিমাণ বাড়ানোর বোতাম (কেজি) */
const MEASURE_STEPS = [1, 5, 10, 25, 50] as const
/** একবারে সর্বোচ্চ পরিমাণ (পিসে = ০.০১ কেজি ধাপে): ১০ হাজার কেজি */
const MEASURE_QTY_MAX = 1_000_000

type CountUnitValue = "piece" | "strip" | "carton"

/** এককের বাংলা নাম (পাতা থাকলে বড় একককে "বক্স", নইলে "কার্টন") */
function unitName(unit: CountUnitValue, p: Pick<Product, "stripSize" | "cartonSize" | "measure">): string {
  if (p.measure) return unit === "carton" ? tr("বস্তা") : measureName(p.measure)
  if (unit === "piece") return tr("পিস")
  if (unit === "strip") return tr("পাতা")
  return hasStrips(p) ? tr("বক্স") : tr("কার্টন")
}

/** ১ একক = কত পিস (পাতার মাপ ঠিক না থাকলে ১) */
function piecesPerUnit(unit: CountUnitValue, p: Pick<Product, "stripSize" | "cartonSize" | "measure">): number {
  try {
    return toPieces({ qty: 1, unit, stripSize: p.stripSize ?? 1, cartonSize: p.cartonSize })
  } catch {
    return 1
  }
}

function StockInForm() {
  const params = useSearchParams()
  const router = useRouter()
  const { db, update, ready } = useDb()
  // শুধু-দেখা মোডে নতুন স্টক-জমা বন্ধ; ব্যানার কারণ বলে
  const readOnlyShop = useReadOnlyShop()
  const { isPharmacy, isOwner } = useSessionInfo()
  const [productId, setProductId] = useState<string | null>(params.get("product"))
  const [query, setQuery] = useState("")
  // ?scan=1 হলে পাতা খুলেই ক্যামেরা চালু (একটানা অনেক পণ্যের স্টক তোলার সময় সুবিধা)
  const [scanning, setScanning] = useState(params.get("scan") === "1")
  const [scanMiss, setScanMiss] = useState<string | null>(null)
  // সর্বশেষ যোগ হওয়া পণ্য: "সেভ করে পরের পণ্য"-র পর নিশ্চিতকরণ দেখায়
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const [unit, setUnit] = useState<CountUnitValue>("piece")
  const [qty, setQty] = useState("")
  const [batchNo, setBatchNo] = useState("")
  const [expiry, setExpiry] = useState("")
  // ক্রয়মূল্য: null = বাছা এককের জন্য পণ্যের বর্তমান দাম (একক বদলালে নিজে হিসাব হয়); লিখলে সেটাই
  const [costEdit, setCostEdit] = useState<string | null>(null)
  const [price, setPrice] = useState("")
  // ফার্মেসিতে দামের ঘর ডিফল্টে গোটানো: বেশিরভাগ সময় দাম একই, তাই টাইপ লাগে না
  const [showPrices, setShowPrices] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const product = productId ? findProduct(db, productId) : undefined
  const results = useMemo(() => searchProducts(db, query), [db, query])

  // পণ্য বাছা হলে তার বর্তমান দাম আগে থেকে বসে যায়; ফার্মেসিতে বড় একক (বক্স) আগে থেকে বাছা, কারণ ডিলার বক্সেই মাল দেয়
  useEffect(() => {
    if (!ready || !productId) return
    const p = findProduct(db, productId)
    if (p) {
      setCostEdit(null)
      setPrice(takaInputValue(p.measure ? perMeasurePoisha(p.pricePoisha) : p.pricePoisha))
      setUnit(isPharmacy && p.cartonSize > 1 ? "carton" : "piece")
      setShowPrices(!isPharmacy || p.costPoisha === 0)
    }
    // শুধু পণ্য বদলালে চলবে; db বদলালে ব্যবহারকারীর লেখা মুছে যাবে
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, productId])

  const choose = (id: string) => setProductId(id)
  const changeUnit = (u: CountUnitValue) => {
    setUnit(u)
    setCostEdit(null)
  }

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
              <Row key={p.id} title={p.name} subtitle={withDetail(p, tf("স্টক {p0}", { p0: (formatCount(totalStock(db, p.id))) }))} onClick={() => choose(p.id)} chevron />
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
    const measured = product.measure != null
    // কেজি/লিটারে "কেজি" এককে পরিমাণ দশমিকে (২.৫), "বস্তা" এককে পূর্ণসংখ্যায়
    const decimalQty = measured && unit === "piece"
    const q = decimalQty ? (parseMeasureQty(qty) ?? NaN) : Number(toAsciiDigits(qty))
    if (!Number.isInteger(q) || q < 1) return setError(decimalQty ? tr("পরিমাণ সঠিকভাবে দিন (যেমন ২.৫, সর্বোচ্চ দুই দশমিক)") : tr("পরিমাণ ১ বা তার বেশি পূর্ণসংখ্যা দিন"))
    const typedCost = cost.trim() ? parseTaka(cost) : 0
    const typedPrice = price.trim() ? parseTaka(price) : null
    if (typedCost == null || (price.trim() && typedPrice == null)) return setError(tr("টাকার পরিমাণ সঠিক নয়"))
    // কেজি/লিটার: দাম প্রতি কেজির; "কেজি" এককে ক্রয়মূল্য প্রতি-পিসে নামিয়ে স্টকে যায়, "বস্তা" এককে সরাসরি
    const pricePoisha = measured && typedPrice != null ? perPiecePoishaFromMeasure(typedPrice) : typedPrice
    if (measured && typedPrice != null && pricePoisha == null) return setError(tr("কেজি বা লিটারের দাম পূর্ণ টাকায় দিন (যেমন ৮৫)"))
    const costPoisha = decimalQty ? perPiecePoishaFromMeasure(typedCost, false) ?? 0 : typedCost
    let expiryDate: string | null = null
    if (expiry.trim()) {
      expiryDate = parseMonthYear(normalizeExpiryInput(expiry))
      if (!expiryDate) return setError(tr("মেয়াদ মাস/বছর আকারে দিন (যেমন ০৬/২০২৭)"))
    }
    try {
      update((d) => stockIn(d, { productId: product.id, qty: q, unit: decimalQty ? "piece" : unit, batchNo, expiryDate, costPoisha, pricePoisha, requireBatchAndExpiry: isPharmacy, batchOptional: true }, new Date()))
    } catch (err) {
      return setError(err instanceof DomainError ? err.message : domainMessage(err))
    }
    if (!next) return router.replace(`/products/detail?id=${product.id}`)
    setLastAdded(tf("✓ {p0}: {p1} যোগ হলো। পরের পণ্য বাছুন।", { p0: product.name, p1: decimalQty ? formatMeasureQty(q, product.measure ?? "kg") : `${formatCount(q)} ${unitName(unit, product)}` }))
    setProductId(null)
    setQty("")
    setBatchNo("")
    setExpiry("")
    setScanMiss(null)
    setQuery("")
    setScanning(true)
  }

  const perCarton = product.cartonSize > 1
  const strips = hasStrips(product)
  const measure = product.measure
  const decimalQty = measure != null && unit === "piece"
  const perUnit = piecesPerUnit(unit, product)
  // ক্রয়মূল্যের ঘরের একক: কেজি/লিটারে "কেজি" = ১০০ পিস, নইলে বাছা এককের পিস-সংখ্যা
  const costMult = decimalQty ? perMeasurePoisha(1) : perUnit
  const cost = costEdit ?? takaInputValue(product.costPoisha * costMult)
  const parsedQty = decimalQty ? parseMeasureQty(qty) : Number(toAsciiDigits(qty))
  const qtyNum = parsedQty ?? 0
  const qtyOk = Number.isInteger(qtyNum) && qtyNum >= 1
  const addedPieces = decimalQty ? qtyNum : qtyNum * perUnit
  const unitOptions = [
    { value: "piece" as const, label: measure ? measureName(measure) : "পিস" },
    ...(strips ? [{ value: "strip" as const, label: "পাতা" }] : []),
    ...(perCarton ? [{ value: "carton" as const, label: measure ? "বস্তা" : strips ? "বক্স" : "কার্টন" }] : []),
  ]
  const unitCost: Record<CountUnitValue, string> = { piece: measure ? tf("ক্রয়মূল্য (প্রতি {p0})", { p0: measureName(measure) }) : tr("ক্রয়মূল্য (প্রতি পিস)"), strip: tr("ক্রয়মূল্য (প্রতি পাতা)"), carton: measure ? tr("ক্রয়মূল্য (প্রতি বস্তা)") : strips ? tr("ক্রয়মূল্য (প্রতি বক্স)") : tr("ক্রয়মূল্য (প্রতি কার্টন)") }
  const qtyLabel = measure
    ? unit === "carton"
      ? tf("বস্তা (১ বস্তা = {p0})", { p0: formatMeasureQty(product.cartonSize, measure) })
      : tf("পরিমাণ ({p0})", { p0: measureName(measure) })
    : unit === "carton"
      ? tf(strips ? "বক্স (১ বক্স = {p0} পিস)" : "কার্টন (১ কার্টন = {p0} পিস)", { p0: formatCount(product.cartonSize) })
      : unit === "strip"
        ? tf("পাতা (১ পাতা = {p0} পিস)", { p0: formatCount(product.stripSize ?? 1) })
        : tr("পরিমাণ (পিস)")
  return (
    <AppShell title={tr("স্টক যোগ")} backHref="/stock" footer={
        <div className="flex gap-2">
          <Button variant={isPharmacy ? "primary" : "secondary"} className="flex-1" onClick={() => submit(true)} disabled={readOnlyShop}>
            {tr("সেভ করে পরের পণ্য")}
          </Button>
          <Button variant={isPharmacy ? "secondary" : "primary"} className="flex-1" onClick={() => submit(false)} disabled={readOnlyShop}>
            {tr("স্টকে যোগ করুন")}
          </Button>
        </div>
      }>
      <Card className="px-4 py-3">
        <div className="font-medium">{product.name}</div>
        <div className="text-[13px] text-muted">
          {measure
            ? `${tr("এখন স্টক")} ${formatMeasureQty(totalStock(db, product.id), measure)} ${tr("· বিক্রয়মূল্য")} ${formatTaka(perMeasurePoisha(product.pricePoisha))}/${measureName(measure)}`
            : <>{tr("এখন স্টক")} {formatCount(totalStock(db, product.id))} {tr("পিস")}{strips ? ` (${packText(totalStock(db, product.id), product)})` : ""} {tr("· বিক্রয়মূল্য")} {formatTaka(product.pricePoisha)}</>}
        </div>
        <button type="button" onClick={() => setProductId(null)} className="mt-1 min-h-11 text-sm text-brand-dark underline">
          {tr("অন্য পণ্য বাছুন")}
        </button>
      </Card>

      {unitOptions.length > 1 ? (
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{tr("কীভাবে গুনছেন")}</span>
          <Segmented label={tr("একক")} options={unitOptions} value={unit} onChange={changeUnit} />
        </div>
      ) : null}
      <Field
        id="si-qty"
        label={qtyLabel}
        inputMode={decimalQty ? "decimal" : "numeric"}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        autoFocus
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr("দ্রুত পরিমাণ যোগ")}>
        {(decimalQty ? MEASURE_STEPS : QTY_STEPS).map((n) => (
          <Button key={n} variant="secondary" className="min-w-14" onClick={() => setQty((q) => (decimalQty ? measureInputValue(Math.min((parseMeasureQty(q) ?? 0) + n * 100, MEASURE_QTY_MAX)) : addToQty(q, n)))}>
            +{formatCount(n)}
          </Button>
        ))}
      </div>
      {qtyOk && unit !== "piece" ? (
        <div className="text-sm text-muted" data-testid="si-total">
          {measure ? tf("মোট {p0} যোগ হবে", { p0: formatMeasureQty(addedPieces, measure) }) : tf("মোট {p0} পিস যোগ হবে", { p0: formatCount(addedPieces) })}
          {strips ? ` (${packText(addedPieces, product)})` : ""}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field id="si-batch" label={tr("ব্যাচ (ঐচ্ছিক)")} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} autoComplete="off" />
        <ExpiryField id="si-expiry" label={isPharmacy ? tr("মেয়াদ (মাস/বছর)") : tr("মেয়াদ (ঐচ্ছিক)")} value={expiry} onChange={setExpiry} quick={isPharmacy} />
      </div>
      {showPrices ? (
        <div className="grid grid-cols-2 gap-3">
          <Field id="si-cost" label={unitCost[unit]} inputMode="decimal" value={cost} onChange={(e) => setCostEdit(e.target.value)} />
          <Field id="si-price" label={measure ? tf("বিক্রয়মূল্য (প্রতি {p0})", { p0: measureName(measure) }) : tr("বিক্রয়মূল্য (প্রতি পিস)")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      ) : (
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm" data-testid="si-price-summary">
            {isOwner
              ? tf("ক্রয় {p0} (প্রতি {p1}) · বিক্রয় {p2} (প্রতি {p3})", { p0: formatTaka(product.costPoisha * costMult), p1: unitName(unit, product), p2: formatTaka(measure ? perMeasurePoisha(product.pricePoisha) : product.pricePoisha), p3: measure ? measureName(measure) : tr("পিস") })
              : tf("বিক্রয় {p0} (প্রতি {p1})", { p0: formatTaka(measure ? perMeasurePoisha(product.pricePoisha) : product.pricePoisha), p1: measure ? measureName(measure) : tr("পিস") })}
          </div>
          <button type="button" onClick={() => setShowPrices(true)} className="min-h-11 shrink-0 text-sm text-brand-dark underline">
            {tr("দাম বদলান")}
          </button>
        </Card>
      )}
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
