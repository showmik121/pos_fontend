"use client"

import { tr, tf } from "@/lib/i18n"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Scanner } from "@/components/scanner"
import { Banner } from "@/components/ui/banner"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, Pill, RowList } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { Sheet } from "@/components/ui/sheet"
import { Stepper } from "@/components/ui/stepper"
import { computeCart } from "@/lib/domain/cart"
import { todayIso } from "@/lib/domain/dates"
import { formatCount, formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { PackQuickAdd } from "@/components/pack-quick-add"
import { addToCart, setCartQty } from "@/lib/store/actions"
import { hasStrips, packText } from "@/lib/store/pack-text"
import { expiredStock, findByBarcode, findProduct, sellableStock } from "@/lib/store/selectors"
import type { Product } from "@/lib/store/types"

export default function SellPage() {
  const { db, update } = useDb()
  const today = todayIso()
  const [scanning, setScanning] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [expiredFor, setExpiredFor] = useState<Product | null>(null)

  // হোমের স্ক্যান বোতাম (/sell?scan=1) থেকে এলে সরাসরি স্ক্যানার খোলে; ঠিকানা থেকে চিহ্নটা সরিয়ে দেয়, যাতে রিফ্রেশে আবার না খোলে
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("scan") !== "1") return
    params.delete("scan")
    const rest = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
    setScanning(true)
  }, [])

  const lines = useMemo(
    () =>
      db.draft.lines.flatMap((l) => {
        const product = findProduct(db, l.productId)
        return product ? [{ line: l, product, sellable: sellableStock(db, product.id, today) }] : []
      }),
    [db, today],
  )

  const totals = useMemo(() => {
    try {
      return computeCart(
        lines.map(({ line, product }) => ({ unitPrice: product.pricePoisha, qty: line.qty, discount: line.discount })),
        db.draft.bill,
      )
    } catch {
      return null
    }
  }, [lines, db.draft.bill])

  const addProduct = (product: Product, qty: number) => {
    update((d) => ({ ...d, draft: addToCart(d.draft, product.id, qty) }))
    if (expiredStock(db, product.id, today).length > 0) setExpiredFor(product)
  }

  /** স্ক্যানার খোলা থাকে (একটানা স্ক্যান); ফেরত লেখাটি স্ক্যানারের ভেতরে দেখায় */
  const onScanned = (code: string): string => {
    const hit = findByBarcode(db, code)
    if (!hit) {
      setNotFound(code)
      return tf("এই বারকোডের পণ্য নেই ({p0})", { p0: (code) })
    }
    setNotFound(null)
    addProduct(hit.product, hit.packSize)
    return tf("✓ {p0} যোগ হলো", { p0: (hit.product.name) })
  }

  const hasDiscount = totals != null && totals.lineDiscount + totals.billDiscount > 0
  const overStock = lines.some((l) => l.line.qty > l.sellable)
  const itemCount = lines.reduce((s, l) => s + l.line.qty, 0)

  return (
    <AppShell
      title={tr("নতুন বিল")}
      backHref="/"
      art={lines.length === 0}
      footer={
        lines.length > 0 && totals ? (
          <div className="space-y-3">
            <Link href="/sell/discount" className="flex min-h-11 items-center justify-between text-[15px]">
              <span className="font-medium">{tr("ছাড়")}</span>
              <span className="flex items-center gap-1 text-brand-dark">
                {hasDiscount ? `−${formatTaka(totals.lineDiscount + totals.billDiscount)}` : tr("যোগ করুন")}
                <Icon name="chevron" size={18} />
              </span>
            </Link>
            <div className="flex items-center justify-between">
              <span className="text-muted">{toBanglaDigits(itemCount)}{tr("টি পণ্য · মোট")}</span>
              <span className="text-2xl font-bold">{formatTaka(totals.total)}</span>
            </div>
            {overStock ? <Banner tone="warn">{tr("কিছু পণ্যের পরিমাণ স্টকের চেয়ে বেশি — কমিয়ে নিন।")}</Banner> : null}
            {overStock ? (
              <Button full disabled>
                {tr("পেমেন্ট নিন")}
              </Button>
            ) : (
              <LinkButton href="/sell/pay" full>
                {tr("পেমেন্ট নিন")}
              </LinkButton>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => setScanning(true)}>
          <Icon name="scan" /> {tr("স্ক্যান করুন")}
        </Button>
        <LinkButton href="/sell/search" variant="secondary">
          <Icon name="search" /> {tr("নাম দিয়ে খুঁজুন")}
        </LinkButton>
      </div>

      {notFound ? (
        <Banner tone="warn">
          {tr("এই বারকোডে কোনো পণ্য নেই।")}{" "}
          <Link href={`/products/new?barcode=${encodeURIComponent(notFound)}`} className="font-semibold underline">
            {tr("নতুন পণ্য হিসেবে যোগ করুন")}
          </Link>
        </Banner>
      ) : null}

      {lines.length === 0 ? (
        <Card className="px-4 py-8 text-center">
          <p className="font-medium">{tr("বিলে কোনো পণ্য নেই")}</p>
          <p className="mt-1 text-sm text-muted">{tr("পণ্যের বারকোড স্ক্যান করুন বা নাম দিয়ে খুঁজে যোগ করুন।")}</p>
        </Card>
      ) : (
        <RowList>
          {lines.map(({ line, product, sellable }) => {
            const gross = product.pricePoisha * line.qty
            return (
              <div key={product.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium leading-snug">{product.name}</div>
                    <div className="text-[13px] text-muted">{tr("প্রতি পিস")} {formatTaka(product.pricePoisha)}{hasStrips(product) ? ` · ${tr("প্রতি পাতা")} ${formatTaka(product.pricePoisha * (product.stripSize ?? 1))}` : ""}</div>
                    {hasStrips(product) ? <div className="text-[13px] font-medium text-brand-dark">{packText(line.qty, { stripSize: product.stripSize, cartonSize: 1 })}</div> : null}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatTaka(gross - line.discount)}</div>
                    {line.discount > 0 ? <div className="text-[13px] text-muted">{tr("ছাড় −")}{formatTaka(line.discount)}</div> : null}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Stepper value={line.qty} onChange={(q) => update((d) => ({ ...d, draft: setCartQty(d.draft, product.id, q) }))} />
                  {line.qty > sellable ? <Pill tone="warn">{tr("স্টকে আছে")} {formatCount(sellable)}</Pill> : null}
                </div>
                <PackQuickAdd product={product} onAdd={(q) => update((d) => ({ ...d, draft: setCartQty(d.draft, product.id, line.qty + q) }))} />
              </div>
            )
          })}
        </RowList>
      )}

      {lines.length > 0 ? (
        <Button variant="ghost" full onClick={() => update((d) => ({ ...d, draft: { ...d.draft, lines: [], bill: { type: "amount", value: 0 }, customerId: null } }))}>
          {tr("বিল খালি করুন")}
        </Button>
      ) : null}

      <Scanner open={scanning} onClose={() => setScanning(false)} onCode={onScanned} continuous title={tr("বিলে স্ক্যান করুন")} />

      <Sheet open={expiredFor != null} onClose={() => setExpiredFor(null)} label={tr("মেয়াদোত্তীর্ণ ব্যাচ")}>
        <h2 className="text-lg font-bold">{tr("মেয়াদোত্তীর্ণ ব্যাচ আছে")}</h2>
        <p className="text-muted">
          {expiredFor?.name}{tr("-এর কিছু ব্যাচের মেয়াদ শেষ। সেগুলো বিক্রি হবে না — শুধু মেয়াদ থাকা ব্যাচ থেকে (যেটার মেয়াদ আগে শেষ হবে সেটা আগে) বিক্রি হবে।")}
        </p>
        <Button full onClick={() => setExpiredFor(null)}>
          {tr("ঠিক আছে, বিক্রি চালু রাখুন")}
        </Button>
        <LinkButton href="/stock/expiry" variant="secondary" full>
          {tr("মেয়াদোত্তীর্ণ স্টক দেখুন ও সরান")}
        </LinkButton>
        <Button
          variant="ghost"
          full
          onClick={() => {
            if (expiredFor) update((d) => ({ ...d, draft: setCartQty(d.draft, expiredFor.id, 0) }))
            setExpiredFor(null)
          }}
        >
          {tr("এই পণ্য বিল থেকে বাদ দিন")}
        </Button>
      </Sheet>
    </AppShell>
  )
}
