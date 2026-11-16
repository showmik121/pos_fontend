"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Sheet } from "@/components/ui/sheet"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka, parseTaka } from "@/lib/domain/money"
import { formatDateTimeBn } from "@/lib/format/datetime"
import { formatPhoneBn } from "@/lib/format/phone"
import { toBanglaDigits } from "@/lib/format/bn"
import { receiveDue, setCartCustomer } from "@/lib/store/actions"
import { customerBalance } from "@/lib/store/selectors"

function CustomerDues() {
  const id = useSearchParams().get("id")
  const router = useRouter()
  const { db, update } = useDb()
  const { actor } = useSessionInfo()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)

  const customer = id ? db.customers.find((c) => c.id === id) : undefined
  if (!customer) {
    return (
      <AppShell title="কাস্টমার" backHref="/dues">
        <Banner tone="warn">কাস্টমার পাওয়া যায়নি।</Banner>
      </AppShell>
    )
  }

  const balance = customerBalance(db, customer.id)
  const entries = db.ledger.filter((e) => e.customerId === customer.id).sort((a, b) => (a.at < b.at ? 1 : -1))

  const deposit = () => {
    setError(null)
    const poisha = parseTaka(amount)
    if (poisha == null || poisha <= 0) return setError("জমার পরিমাণ সঠিকভাবে দিন")
    try {
      update((d) => receiveDue(d, customer.id, poisha, actor, new Date()))
      setOpen(false)
      setAmount("")
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  const sellOnCredit = () => {
    update((d) => ({ ...d, draft: setCartCustomer(d.draft, customer.id) }))
    router.push("/sell")
  }

  return (
    <AppShell title={customer.name} backHref="/dues">
      <Card className="px-4 py-4 text-center">
        <div className="text-sm text-muted">{customer.phone ? formatPhoneBn(customer.phone) : "মোবাইল নেই"}</div>
        <div className="mt-1 text-sm text-muted">বর্তমান বাকি</div>
        <div className={`text-[32px] font-bold leading-tight ${balance > 0 ? "text-warn" : ""}`}>{formatTaka(balance)}</div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => setOpen(true)} disabled={balance <= 0}>
          টাকা জমা নিন
        </Button>
        <Button variant="secondary" onClick={sellOnCredit}>
          বাকিতে বিক্রি
        </Button>
      </div>

      <SectionTitle>খাতা</SectionTitle>
      {entries.length === 0 ? (
        <Card className="px-4 py-5 text-center text-muted">কোনো লেনদেন নেই।</Card>
      ) : (
        <RowList>
          {entries.map((e) => (
            <Row
              key={e.id}
              title={e.kind === "payment" ? "জমা" : e.kind === "opening" ? "আগের বাকি" : `বিল #${e.saleNo != null ? toBanglaDigits(e.saleNo) : ""}`}
              subtitle={`${formatDateTimeBn(e.at)}${e.by ? ` · ${e.by}` : ""}`}
              right={<span className={e.kind === "payment" ? "font-semibold text-brand-dark" : "font-semibold"}>{e.kind === "payment" ? `−${formatTaka(e.amount)}` : `+${formatTaka(e.amount)}`}</span>}
            />
          ))}
        </RowList>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} label="টাকা জমা">
        <h2 className="text-lg font-bold">টাকা জমা নিন</h2>
        <p className="text-muted">বাকি আছে {formatTaka(balance)}</p>
        <Field id="due-amount" label="কত টাকা পেলেন" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        <Button variant="secondary" onClick={() => setAmount(String(balance / 100))}>
          পুরো বাকি
        </Button>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button full onClick={deposit}>
          জমা নিন
        </Button>
      </Sheet>
    </AppShell>
  )
}

export default function CustomerDuesPage() {
  return (
    <Suspense fallback={<Splash />}>
      <CustomerDues />
    </Suspense>
  )
}
