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
import { formatBillNo } from "@/lib/domain/bill"
import { receiveDue, setCartCustomer, setPromise } from "@/lib/store/actions"
import { addDays, formatDayMonthBn, todayIso } from "@/lib/domain/dates"
import { customerBalance } from "@/lib/store/selectors"
import { balanceAfter, depositReceiptText, reminderText, smsHref } from "@/lib/store/dues-view"

function CustomerDues() {
  const id = useSearchParams().get("id")
  const router = useRouter()
  const { db, update, run } = useDb()
  const { actor, storeName } = useSessionInfo()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [promiseOpen, setPromiseOpen] = useState(false)
  const [promiseDate, setPromiseDate] = useState("")
  const [promiseNote, setPromiseNote] = useState("")
  const [promiseError, setPromiseError] = useState<string | null>(null)

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
      const entryId = run((d) => {
        const next = receiveDue(d, customer.id, poisha, actor, new Date())
        return { db: next, value: next.ledger.find((e) => !d.ledger.some((x) => x.id === e.id))?.id ?? null }
      })
      setOpen(false)
      setAmount("")
      setShareNote(null)
      setReceiptId(entryId)
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  const openPromise = () => {
    setPromiseDate(customer.promise?.date ?? "")
    setPromiseNote(customer.promise?.note ?? "")
    setPromiseError(null)
    setPromiseOpen(true)
  }

  const savePromise = (date: string | null) => {
    setPromiseError(null)
    if (date !== null && !date) return setPromiseError("তারিখ বাছুন")
    try {
      update((d) => setPromise(d, customer.id, date, promiseNote, new Date()))
      setPromiseOpen(false)
    } catch (err) {
      setPromiseError(domainMessage(err))
    }
  }

  const receiptEntry = receiptId ? db.ledger.find((e) => e.id === receiptId && e.kind === "payment") : undefined
  const receiptText = receiptEntry
    ? depositReceiptText({ storeName, customerName: customer.name, at: receiptEntry.at, amount: receiptEntry.amount, balanceAfter: balanceAfter(db.ledger, customer.id, receiptEntry.id) })
    : ""

  const shareReceipt = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: receiptText })
        return
      }
      await navigator.clipboard.writeText(receiptText)
      setShareNote("রসিদের লেখা কপি হয়েছে — মেসেজে পেস্ট করে পাঠান।")
    } catch {
      // শেয়ার বাতিল করলে কিছু করার নেই
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

      {balance > 0 ? (
        <Card className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm text-muted">কবে দেবে</div>
            {customer.promise ? (
              <div className={`font-semibold ${customer.promise.date < todayIso() ? "text-warn" : ""}`}>
                {formatDayMonthBn(customer.promise.date)}
                {customer.promise.note ? <span className="font-normal text-muted"> · {customer.promise.note}</span> : null}
              </div>
            ) : (
              <div className="text-muted">তারিখ লেখা নেই</div>
            )}
          </div>
          <Button variant="secondary" className="min-h-10 px-3 text-sm" onClick={openPromise}>
            {customer.promise ? "বদলান" : "তারিখ দিন"}
          </Button>
        </Card>
      ) : null}

      {customer.phone ? (
        <div className="grid grid-cols-2 gap-3">
          <a href={`tel:${customer.phone}`} className="flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-white font-medium active:bg-canvas">কল করুন</a>
          {balance > 0 ? (
            <a href={smsHref(customer.phone, reminderText({ customerName: customer.name, balance, storeName }))} className="flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-white font-medium active:bg-canvas">এসএমএসে তাগাদা</a>
          ) : null}
        </div>
      ) : null}

      <SectionTitle>খাতা</SectionTitle>
      {entries.length === 0 ? (
        <Card className="px-4 py-5 text-center text-muted">কোনো লেনদেন নেই।</Card>
      ) : (
        <RowList>
          {entries.map((e) => (
            <Row
              key={e.id}
              onClick={e.kind === "payment" ? () => { setShareNote(null); setReceiptId(e.id) } : undefined}
              title={e.kind === "payment" ? "জমা" : e.kind === "opening" ? "আগের বাকি" : e.kind === "void" ? `বিল #${e.saleNo != null ? formatBillNo({ no: e.saleNo, prefix: e.salePrefix }) : ""} বাতিল` : `বিল #${e.saleNo != null ? formatBillNo({ no: e.saleNo, prefix: e.salePrefix }) : ""}`}
              subtitle={`${formatDateTimeBn(e.at)}${e.by ? ` · ${e.by}` : ""}`}
              right={<span className={e.kind === "payment" || e.kind === "void" ? "font-semibold text-brand-dark" : "font-semibold"}>{e.kind === "payment" || e.kind === "void" ? `−${formatTaka(e.amount)}` : `+${formatTaka(e.amount)}`}</span>}
            />
          ))}
        </RowList>
      )}

      <Sheet open={receiptEntry !== undefined} onClose={() => setReceiptId(null)} label="জমার রসিদ">
        <h2 className="text-lg font-bold">জমা নেওয়া হয়েছে</h2>
        <pre className="whitespace-pre-wrap rounded-xl bg-canvas px-3 py-3 font-[inherit] text-[15px] leading-relaxed">{receiptText}</pre>
        {shareNote ? <Banner tone="info">{shareNote}</Banner> : null}
        <Button full onClick={shareReceipt}>
          রসিদ পাঠান
        </Button>
        <Button full variant="secondary" onClick={() => setReceiptId(null)}>
          বন্ধ করুন
        </Button>
      </Sheet>

      <Sheet open={promiseOpen} onClose={() => setPromiseOpen(false)} label="আদায়ের তারিখ">
        <h2 className="text-lg font-bold">কবে দেবে?</h2>
        <p className="text-muted">সেদিন হোম পেজে মনে করিয়ে দেব।</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["আজ", 0],
            ["কাল", 1],
            ["৩ দিন পর", 3],
            ["৭ দিন পর", 7],
          ].map(([label, n]) => (
            <Button key={label} variant="secondary" className="min-h-10 px-3 text-sm" onClick={() => setPromiseDate(addDays(todayIso(), n as number))}>
              {label}
            </Button>
          ))}
        </div>
        <Field id="promise-date" label="তারিখ" type="date" min={todayIso()} value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} hint={promiseDate ? formatDayMonthBn(promiseDate) : undefined} />
        <Field id="promise-note" label="নোট (ইচ্ছা হলে)" placeholder="যেমন: বেতন পেয়ে দেবে" maxLength={120} value={promiseNote} onChange={(e) => setPromiseNote(e.target.value)} />
        {promiseError ? <Banner tone="danger">{promiseError}</Banner> : null}
        <Button full onClick={() => savePromise(promiseDate)}>
          সংরক্ষণ
        </Button>
        {customer.promise ? (
          <Button full variant="secondary" onClick={() => savePromise(null)}>
            তারিখ মুছুন
          </Button>
        ) : null}
      </Sheet>

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
