"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell, Ready } from "@/components/app-shell"
import { CustomerPicker } from "@/components/customer-picker"
import { useDb } from "@/components/db-provider"
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
import { findProduct } from "@/lib/store/selectors"

const METHODS = [
  { value: "bkash", label: "বিকাশ" },
  { value: "nagad", label: "নগদ" },
  { value: "rocket", label: "রকেট" },
] as const

function PayScreen() {
  const { db, update, run } = useDb()
  const router = useRouter()
  const { actor } = useSessionInfo()
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
    if (mobile == null || cash == null) return { error: "টাকার পরিমাণ সঠিক নয়" }
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
        const out = completeSale(d, { cashier: actor, cash, mobile, mobileMethod: method }, new Date())
        return { db: out.db, value: out.sale }
      })
      router.replace(`/sell/receipt?id=${sale.id}`)
    } catch (err) {
      completed.current = false
      setError(domainMessage(err))
    }
  }

  const due = settled.error ? 0 : (settled as { due: number }).due
  const change = settled.error ? 0 : (settled as { change: number }).change

  return (
    <AppShell
      title="পেমেন্ট"
      backHref="/sell"
      footer={
        <Button full onClick={confirm} disabled={Boolean(settled.error) || lines.length === 0}>
          বিল সম্পন্ন করুন
        </Button>
      }
    >
      <Card className="px-4 py-4 text-center">
        <div className="text-sm text-muted">মোট প্রাপ্য</div>
        <div className="text-[32px] font-bold leading-tight">{formatTaka(total)}</div>
      </Card>

      <h2 className="text-[15px] font-semibold">কত পেলেন</h2>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">ক্যাশ</span>
          <AmountInput id="pay-cash" label="ক্যাশ টাকা" value={cashInput ?? takaInputValue(cash ?? 0)} onChange={(e) => setCashInput(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">মোবাইল ব্যাংকিং</span>
            <AmountInput id="pay-mobile" label="মোবাইল ব্যাংকিংয়ে পাওয়া" placeholder="০" value={mobileInput} onChange={(e) => setMobileInput(e.target.value)} />
          </div>
          <Segmented label="মোবাইল ব্যাংকিংয়ের মাধ্যম" options={METHODS} value={method} onChange={setMethod} />
        </div>
      </Card>

      {settled.error ? (
        <Banner tone="danger">{settled.error}</Banner>
      ) : due > 0 ? (
        <Banner tone="warn">বাকি থাকছে {formatTaka(due)} — কাস্টমারের খাতায় উঠবে</Banner>
      ) : change > 0 ? (
        <Banner tone="info">ফেরত দিন {formatTaka(change)}</Banner>
      ) : (
        <Banner tone="info">হিসাব মিলেছে</Banner>
      )}

      <h2 className="text-[15px] font-semibold">কাস্টমার {due > 0 ? "(বাকির জন্য দরকার)" : "(ঐচ্ছিক)"}</h2>
      <RowList>
        {customer ? (
          <>
            <Row title={customer.name} subtitle="এই বিলের কাস্টমার" onClick={() => setPicking(true)} chevron />
            <div className="px-4 py-1">
              <Button variant="ghost" onClick={() => update((d) => ({ ...d, draft: setCartCustomer(d.draft, null) }))}>
                কাস্টমার সরান
              </Button>
            </div>
          </>
        ) : (
          <Row title="কাস্টমার বাছুন" subtitle="বাকি রাখতে বা হিসাবের জন্য" onClick={() => setPicking(true)} chevron />
        )}
      </RowList>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      <RowList>
        <KeyValue label="পণ্যের সংখ্যা" value={`${lines.length}টি`} />
      </RowList>
      <LinkButton href="/sell" variant="ghost" full>
        বিলে ফিরে যান
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
