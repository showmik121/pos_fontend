"use client"

import { tr, tf } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell, Ready } from "@/components/app-shell"
import { CustomerPicker } from "@/components/customer-picker"
import { useDb } from "@/components/db-provider"
import { useReadOnlyShop } from "@/components/tenant-notice"
import { Banner } from "@/components/ui/banner"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, KeyValue, Row, RowList } from "@/components/ui/card"
import { AmountInput } from "@/components/ui/inputs"
import { Segmented } from "@/components/ui/segmented"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { computeCart, settlePayments, type MobileMethod } from "@/lib/domain/cart"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka, parseTaka, takaInputValue } from "@/lib/domain/money"
import { completeSale, setCartCustomer } from "@/lib/store/actions"
import { limitStatus } from "@/lib/store/dues-view"
import { customerBalance } from "@/lib/store/selectors"
import { loadDevice } from "@/lib/store/device"
import { findProduct } from "@/lib/store/selectors"

const METHODS = [
  { value: "bkash", label: "বিকাশ" },
  { value: "nagad", label: "নগদ" },
  { value: "rocket", label: "রকেট" },
] as const

function PayScreen() {
  const { db, update, run } = useDb()
  // শুধু-দেখা মোডে নতুন বিক্রি বন্ধ (সার্ভারও ৪০৩ দিত); ব্যানার কারণ বলে
  const readOnlyShop = useReadOnlyShop()
  const router = useRouter()
  const { actor, storeId } = useSessionInfo()
  const [picking, setPicking] = useState(false)
  const [method, setMethod] = useState<MobileMethod>("bkash")
  const [mobileInput, setMobileInput] = useState("")
  const [cashInput, setCashInput] = useState<string | null>(null) // null = মোটের সমান (স্বয়ংক্রিয়)
  const [error, setError] = useState<string | null>(null)
  const completed = useRef(false)

  const lines = db.draft.lines.flatMap((l) => {
    const product = findProduct(db, l.productId)
    return product ? [{ line: l, product }] : []
  })
  const customer = db.draft.customerId ? db.customers.find((c) => c.id === db.draft.customerId) ?? null : null

  useEffect(() => {
    // খালি বিল নিয়ে এখানে আসার মানে নেই
    if (lines.length === 0 && !completed.current) router.replace("/sell")
  }, [lines.length, router])

  const total = useMemo(() => {
    try {
      return computeCart(
        lines.map(({ line, product }) => ({ unitPrice: product.pricePoisha, qty: line.qty, discount: line.discount })),
        db.draft.bill,
      ).total
    } catch {
      return 0
    }
  }, [lines, db.draft.bill])

  const mobile = mobileInput.trim() ? parseTaka(mobileInput) : 0
  // নগদ ঘর ফাঁকা থাকলে: মোটের বাকি অংশটুকু ধরা হয়
  const cash = cashInput === null ? Math.max(0, total - (mobile ?? 0)) : cashInput.trim() ? parseTaka(cashInput) : 0

  const settled = useMemo(() => {
    if (mobile == null || cash == null) return { error: tr("টাকার পরিমাণ সঠিক নয়") }
    try {
      return { ...settlePayments({ total, cash, mobile, mobileMethod: method, hasCustomer: customer != null }), error: null as string | null }
    } catch (err) {
      return { error: domainMessage(err) }
    }
  }, [total, cash, mobile, method, customer])

  const confirm = () => {
    setError(null)
    if (mobile == null || cash == null) return
    try {
      completed.current = true
      const sale = run((d) => {
        const out = completeSale(d, { cashier: actor, cash, mobile, mobileMethod: method, devicePrefix: storeId ? loadDevice(storeId).code : null }, new Date())
        return { db: out.db, value: out.sale }
      })
      router.replace(`/sell/receipt?id=${sale.id}`)
    } catch (err) {
      completed.current = false
      setError(domainMessage(err))
    }
  }

  const due = settled.error ? 0 : (settled as { due: number }).due
  const limit = customer && due > 0 ? limitStatus(customer.creditLimit, customerBalance(db, customer.id), due) : null
  const change = settled.error ? 0 : (settled as { change: number }).change

  return (
    <AppShell
      title={tr("পেমেন্ট")}
      backHref="/sell"
      footer={
        <Button full onClick={confirm} disabled={Boolean(settled.error) || lines.length === 0 || readOnlyShop}>
          {tr("বিল সম্পন্ন করুন")}
        </Button>
      }
    >
      <Card className="px-4 py-4 text-center">
        <div className="text-sm text-muted">{tr("মোট প্রাপ্য")}</div>
        <div className="text-[32px] font-bold leading-tight">{formatTaka(total)}</div>
      </Card>

      <h2 className="text-[15px] font-semibold">{tr("কত পেলেন")}</h2>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{tr("ক্যাশ")}</span>
          <AmountInput id="pay-cash" label={tr("ক্যাশ টাকা")} value={cashInput ?? takaInputValue(cash ?? 0)} onChange={(e) => setCashInput(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{tr("মোবাইল ব্যাংকিং")}</span>
            <AmountInput id="pay-mobile" label={tr("মোবাইল ব্যাংকিংয়ে পাওয়া")} placeholder={tr("০")} value={mobileInput} onChange={(e) => setMobileInput(e.target.value)} />
          </div>
          <Segmented label={tr("মোবাইল ব্যাংকিংয়ের মাধ্যম")} options={METHODS} value={method} onChange={setMethod} />
        </div>
      </Card>

      {settled.error ? (
        <Banner tone="danger">{settled.error}</Banner>
      ) : due > 0 ? (
        <Banner tone="warn">{tr("বাকি থাকছে")} {formatTaka(due)} {tr("— কাস্টমারের খাতায় উঠবে")}</Banner>
      ) : change > 0 ? (
        <Banner tone="info">{tr("ফেরত দিন")} {formatTaka(change)}</Banner>
      ) : (
        <Banner tone="info">{tr("হিসাব মিলেছে")}</Banner>
      )}

      {limit?.over ? (
        <Banner tone="danger">{tr("বাকির সীমা")} {formatTaka(limit.limit)}{tr("। এই বিলের পর")} {customer?.name}{tr("-এর বাকি হবে")} {formatTaka(limit.after)}{tr("। চাইলে তবুও বিল করতে পারেন।")}</Banner>
      ) : null}

      <h2 className="text-[15px] font-semibold">{tr("কাস্টমার")} {due > 0 ? tr("(বাকির জন্য দরকার)") : tr("(ঐচ্ছিক)")}</h2>
      <RowList>
        {customer ? (
          <>
            <Row title={customer.name} subtitle={tr("এই বিলের কাস্টমার")} onClick={() => setPicking(true)} chevron />
            <div className="px-4 py-1">
              <Button variant="ghost" onClick={() => update((d) => ({ ...d, draft: setCartCustomer(d.draft, null) }))}>
                {tr("কাস্টমার সরান")}
              </Button>
            </div>
          </>
        ) : (
          <Row title={tr("কাস্টমার বাছুন")} subtitle={tr("বাকি রাখতে বা হিসাবের জন্য")} onClick={() => setPicking(true)} chevron />
        )}
      </RowList>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      <RowList>
        <KeyValue label={tr("পণ্যের সংখ্যা")} value={tf("{p0}টি", { p0: (lines.length) })} />
      </RowList>
      <LinkButton href="/sell" variant="ghost" full>
        {tr("বিলে ফিরে যান")}
      </LinkButton>

      <CustomerPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          update((d) => ({ ...d, draft: setCartCustomer(d.draft, id) }))
          setPicking(false)
        }}
      />
    </AppShell>
  )
}

export default function PayPage() {
  return (
    <Ready>
      <PayScreen />
    </Ready>
  )
}
