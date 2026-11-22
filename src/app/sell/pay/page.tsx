"use client"

import { tr, tf } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { AppShell, Ready } from "@/components/app-shell"
import { CustomerPicker } from "@/components/customer-picker"
import { useDb } from "@/components/db-provider"
import { useReadOnlyShop } from "@/components/tenant-notice"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, Row, RowList, SectionTitle } from "@/components/ui/card"
import { AmountInput } from "@/components/ui/inputs"
import { MethodTiles } from "@/components/pay/method-tiles"
import { Segmented } from "@/components/ui/segmented"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { computeCart, settlePayments, type MobileMethod } from "@/lib/domain/cart"
import { PAY_METHODS, quickCashAmounts, resolveEntry, type PayMethod } from "@/lib/domain/pay-entry"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka, takaInputValue } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { completeSale, setCartCustomer } from "@/lib/store/actions"
import { limitStatus } from "@/lib/store/dues-view"
import { customerBalance } from "@/lib/store/selectors"
import { loadDevice } from "@/lib/store/device"
import { findProduct } from "@/lib/store/selectors"

// ভাগ করে নেওয়ার সময় মোবাইলের মাধ্যম (রকেট নতুন বিলে নেই)
const MOBILE_METHODS = [
  { value: "bkash", label: "বিকাশ" },
  { value: "nagad", label: "নগদ" },
] as const

const chipClass = (on: boolean) =>
  `press h-10 whitespace-nowrap rounded-full px-3.5 text-sm ${on ? "border-[1.5px] border-brand bg-brand-soft font-semibold text-brand-dark" : "border border-line-strong/70 bg-white font-medium text-ink"}`

function PayScreen() {
  const { db, update, run } = useDb()
  // শুধু-দেখা মোডে নতুন বিক্রি বন্ধ (সার্ভারও ৪০৩ দিত); ব্যানার কারণ বলে
  const readOnlyShop = useReadOnlyShop()
  const router = useRouter()
  const { actor, storeId } = useSessionInfo()
  const [picking, setPicking] = useState(false)
  const [mode, setMode] = useState<"single" | "split">("single")
  const [method, setMethod] = useState<PayMethod>("cash") // একক মোডে বাছা মাধ্যম
  const [amount, setAmount] = useState<string | null>(null) // null = পুরো মোট (স্বয়ংক্রিয়)
  const [splitMethod, setSplitMethod] = useState<MobileMethod>("bkash")
  const [mobileInput, setMobileInput] = useState("")
  const [cashInput, setCashInput] = useState<string | null>(null) // null = মোটের বাকি অংশ (স্বয়ংক্রিয়)
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

  const entry = useMemo(
    () => resolveEntry({ mode, method, amount, cashInput, mobileInput, splitMethod, total }),
    [mode, method, amount, cashInput, mobileInput, splitMethod, total],
  )

  const settled = useMemo(() => {
    if (!entry.ok) return { error: tr("টাকার পরিমাণ সঠিক নয়") }
    try {
      return { ...settlePayments({ total, cash: entry.cash, mobile: entry.mobile, mobileMethod: entry.mobileMethod, hasCustomer: customer != null }), error: null as string | null }
    } catch (err) {
      return { error: domainMessage(err) }
    }
  }, [total, entry, customer])

  const confirm = () => {
    setError(null)
    if (!entry.ok) return
    try {
      completed.current = true
      const sale = run((d) => {
        const out = completeSale(d, { cashier: actor, cash: entry.cash, mobile: entry.mobile, mobileMethod: entry.mobileMethod, devicePrefix: storeId ? loadDevice(storeId).code : null }, new Date())
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

  const quick = method === "cash" ? quickCashAmounts(total) : []
  const amountText = amount ?? takaInputValue(total)
  const isFull = amount === null || (entry.ok && entry.cash + entry.mobile === total)

  const pickMethod = (m: PayMethod) => {
    setMethod(m)
    setAmount(null) // মাধ্যম বদলালে আবার পুরো মোট
  }

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
        <div className="text-[36px] font-bold leading-tight">{formatTaka(total)}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {tr("পণ্যের সংখ্যা")}: {tf("{p0}টি", { p0: toBanglaDigits(lines.length) })}
        </div>
      </Card>

      {mode === "single" ? (
        <>
          <SectionTitle>{tr("কীভাবে নিলেন")}</SectionTitle>
          <MethodTiles options={PAY_METHODS} value={method} onChange={pickMethod} label={tr("পেমেন্টের মাধ্যম")} />

          <SectionTitle>{tr("কত পেলেন")}</SectionTitle>
          <Card className="space-y-3 p-4">
            <label htmlFor="pay-amount" className="sr-only">
              {tr("পাওয়া টাকার পরিমাণ")}
            </label>
            <div className="flex h-14 items-center rounded-xl border border-line-strong bg-white px-3 focus-within:border-brand">
              <span aria-hidden="true" className="text-xl font-semibold text-muted">৳</span>
              <input
                id="pay-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amountText}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-full min-w-0 flex-1 bg-transparent pl-2 text-right text-2xl font-bold text-ink outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={isFull} onClick={() => setAmount(null)} className={chipClass(isFull)}>
                {tr("পুরো টাকা")}
              </button>
              {quick.map((q) => (
                <button key={q} type="button" aria-pressed={amount === takaInputValue(q)} onClick={() => setAmount(takaInputValue(q))} className={chipClass(amount === takaInputValue(q))}>
                  {formatTaka(q)}
                </button>
              ))}
              <button type="button" aria-pressed={amount !== null && amount.trim() === "0"} onClick={() => setAmount("0")} className={chipClass(amount !== null && amount.trim() === "0")}>
                {tr("পুরোটা বাকি")}
              </button>
            </div>
          </Card>
          <Button variant="ghost" full onClick={() => setMode("split")}>
            {tr("ক্যাশ ও মোবাইল ভাগ করে নিন")}
          </Button>
        </>
      ) : (
        <>
          <SectionTitle>{tr("কত পেলেন")}</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{tr("ক্যাশ")}</span>
              <AmountInput id="pay-cash" label={tr("ক্যাশ টাকা")} value={cashInput ?? takaInputValue(entry.ok ? entry.cash : 0)} onChange={(e) => setCashInput(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{tr("মোবাইল ব্যাংকিং")}</span>
                <AmountInput id="pay-mobile" label={tr("মোবাইল ব্যাংকিংয়ে পাওয়া")} placeholder={tr("০")} value={mobileInput} onChange={(e) => setMobileInput(e.target.value)} />
              </div>
              <Segmented label={tr("মোবাইল ব্যাংকিংয়ের মাধ্যম")} options={MOBILE_METHODS} value={splitMethod} onChange={setSplitMethod} />
            </div>
          </Card>
          <Button variant="ghost" full onClick={() => { setMode("single"); setAmount(null) }}>
            {tr("একটি মাধ্যমে নিন")}
          </Button>
        </>
      )}

      {settled.error ? (
        <Banner tone="danger">{settled.error}</Banner>
      ) : due > 0 ? (
        <Banner tone="warn">{tr("বাকি থাকছে")} {formatTaka(due)} {tr("— কাস্টমারের খাতায় উঠবে")}</Banner>
      ) : change > 0 ? (
        <div role="status" className="flex items-center justify-between rounded-xl bg-gold-soft px-4 py-3 text-ink">
          <span className="text-[15px] font-semibold">{tr("ফেরত দিন")}</span>
          <span className="text-2xl font-bold">{formatTaka(change)}</span>
        </div>
      ) : (
        <Banner tone="info">{tr("হিসাব মিলেছে")}</Banner>
      )}

      {limit?.over ? (
        <Banner tone="danger">{tr("বাকির সীমা")} {formatTaka(limit.limit)}{tr("। এই বিলের পর")} {customer?.name}{tr("-এর বাকি হবে")} {formatTaka(limit.after)}{tr("। চাইলে তবুও বিল করতে পারেন।")}</Banner>
      ) : null}

      <SectionTitle>{tr("কাস্টমার")} {due > 0 ? tr("(বাকির জন্য দরকার)") : tr("(ঐচ্ছিক)")}</SectionTitle>
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
