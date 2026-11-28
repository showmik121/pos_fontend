"use client"

import { tr, tf } from "@/lib/i18n"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, KeyValue } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Sheet } from "@/components/ui/sheet"
import { domainMessage } from "@/lib/domain/errors"
import { voidSale } from "@/lib/store/actions"
import { Icon } from "@/components/ui/icons"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { formatTaka } from "@/lib/domain/money"
import { formatDateTimeBn } from "@/lib/format/datetime"
import { formatBillNo } from "@/lib/domain/bill"
import { toBanglaDigits } from "@/lib/format/bn"
import type { Db, Sale } from "@/lib/store/types"
import { lineQtyText } from "@/lib/store/pack-text"
import { findProduct } from "@/lib/store/selectors"

const METHOD_LABEL = { cash: "ক্যাশ", bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট" } as const

function receiptText(storeName: string, sale: Sale, db: Db): string {
  const rows = sale.lines.map((l) => `${l.name} ${lineQtyText(findProduct(db, l.productId)?.measure, l.unitPrice, l.qty).replace(/^.*? × /, "× ")} = ${formatTaka(l.unitPrice * l.qty - l.discount)}`)
  const out = sale.voided ? [tr("*** বাতিল বিল ***"), storeName, tf("বিল নং {p0} · {p1}", { p0: (formatBillNo(sale)), p1: (formatDateTimeBn(sale.at)) }), "", ...rows, ""] : [storeName, tf("বিল নং {p0} · {p1}", { p0: (formatBillNo(sale)), p1: (formatDateTimeBn(sale.at)) }), "", ...rows, ""]
  if (sale.lineDiscount + sale.billDiscount > 0) out.push(tf("ছাড়: −{p0}", { p0: (formatTaka(sale.lineDiscount + sale.billDiscount)) }))
  out.push(tf("মোট: {p0}", { p0: (formatTaka(sale.total)) }))
  for (const p of sale.payments) out.push(`${tr(METHOD_LABEL[p.method])}: ${formatTaka(p.amount)}`)
  if (sale.change > 0) out.push(tf("ফেরত: {p0}", { p0: (formatTaka(sale.change)) }))
  if (sale.due > 0) out.push(tf("বাকি: {p0}", { p0: (formatTaka(sale.due)) }))
  out.push("", tr("ধন্যবাদ!"))
  return out.join("\n")
}

function ReceiptView() {
  const params = useSearchParams()
  const id = params.get("id")
  const { db, run } = useDb()
  const { state } = useAuth()
  const { storeName } = useSessionInfo()
  const [note, setNote] = useState<string | null>(null)
  const [voidOpen, setVoidOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [voidError, setVoidError] = useState<string | null>(null)
  const isOwner = state.status === "authed" && state.user.role === "owner"
  const sale = db.sales.find((s) => s.id === id)

  if (!sale) {
    return (
      <AppShell title={tr("রসিদ")} backHref="/">
        <Banner tone="warn">{tr("এই বিলটি পাওয়া যায়নি।")}</Banner>
        <LinkButton href="/sell" full>
          {tr("নতুন বিল")}
        </LinkButton>
      </AppShell>
    )
  }

  const share = async () => {
    const text = receiptText(storeName, sale, db)
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setNote(tr("রসিদের লেখা কপি হয়েছে — মেসেজে পেস্ট করে পাঠান।"))
    } catch {
      // শেয়ার বাতিল করলে কিছু করার নেই
    }
  }

  const confirmVoid = () => {
    if (state.status !== "authed") return
    try {
      const out = run((d) => {
        const r = voidSale(d, sale.id, { by: state.user.name, reason }, new Date())
        return { db: r.db, value: r }
      })
      const parts = [tf("বিল বাতিল হয়েছে; {p0} পিস স্টকে ফিরেছে।", { p0: (toBanglaDigits(out.restoredQty)) })]
      if (out.refundPoisha > 0) parts.push(tf("কাস্টমারকে {p0} ফেরত দিন।", { p0: (formatTaka(out.refundPoisha)) }))
      if (out.lostQty > 0) parts.push(tf("{p0} পিসের ব্যাচ আগেই মুছে ফেলা ছিল, তাই ফেরানো যায়নি; স্টক হাতে গুনে মিলিয়ে নিন।", { p0: (toBanglaDigits(out.lostQty)) }))
      setNote(parts.join(" "))
      setVoidOpen(false)
      setReason("")
      setVoidError(null)
    } catch (err) {
      setVoidError(domainMessage(err))
    }
  }

  return (
    <AppShell
      title={tf("বিল #{p0}", { p0: (formatBillNo(sale)) })}
      backHref="/"
      footer={
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={share}>
            <Icon name="share" /> {tr("শেয়ার")}
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="print" /> {tr("প্রিন্ট")}
          </Button>
          <LinkButton href="/sell">{tr("নতুন বিল")}</LinkButton>
        </div>
      }
    >
      {sale.voided ? (
        <Banner tone="danger">
          {tr("এই বিল বাতিল করা হয়েছে (")}{sale.voided.by}, {formatDateTimeBn(sale.voided.at)}{tr(") — কারণ:")} {sale.voided.reason}
        </Banner>
      ) : (
        <Banner tone="info">{tr("বিল সম্পন্ন হয়েছে।")}</Banner>
      )}
      <Card>
        <div className="space-y-1 px-4 py-4 text-center">
          <div className="text-lg font-bold">{storeName}</div>
          <div className="text-sm text-muted">
            {tr("বিল নং")} {formatBillNo(sale)} · {formatDateTimeBn(sale.at)}
          </div>
          {sale.customerName ? <div className="text-sm text-muted">{tr("কাস্টমার:")} {sale.customerName}</div> : null}
        </div>
        <div className="divide-y divide-line border-t border-line">
          {sale.lines.map((l) => (
            <div key={l.productId} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="font-medium">{l.name}</div>
                <div className="text-[13px] text-muted">
                  {lineQtyText(findProduct(db, l.productId)?.measure, l.unitPrice, l.qty)}
                  {l.discount > 0 ? tf(" · ছাড় −{p0}", { p0: (formatTaka(l.discount)) }) : ""}
                </div>
              </div>
              <div className="font-medium">{formatTaka(l.unitPrice * l.qty - l.discount)}</div>
            </div>
          ))}
        </div>
        <div className="divide-y divide-line border-t border-line">
          {sale.lineDiscount + sale.billDiscount > 0 ? <KeyValue label={tr("মোট ছাড়")} value={`−${formatTaka(sale.lineDiscount + sale.billDiscount)}`} /> : null}
          <KeyValue label={tr("মোট")} value={formatTaka(sale.total)} strong />
          {sale.payments.map((p) => (
            <KeyValue key={p.method} label={tr(METHOD_LABEL[p.method])} value={formatTaka(p.amount)} />
          ))}
          {sale.change > 0 ? <KeyValue label={tr("ফেরত")} value={formatTaka(sale.change)} /> : null}
          {sale.due > 0 ? <KeyValue label={tr("বাকি")} value={formatTaka(sale.due)} /> : null}
        </div>
      </Card>
      {note ? <Banner tone="info">{note}</Banner> : null}
      {isOwner && !sale.voided ? (
        <div className="no-print">
          <Button variant="danger" full onClick={() => setVoidOpen(true)}>
            {tr("বিল বাতিল করুন")}
          </Button>
        </div>
      ) : null}
      <Sheet open={voidOpen} onClose={() => setVoidOpen(false)} label={tr("বিল বাতিল")}>
        <h2 className="text-lg font-bold">{tr("বিল #")}{formatBillNo(sale)} {tr("বাতিল করবেন?")}</h2>
        <p className="text-sm text-muted">{tr("পণ্য স্টকে ফিরবে আর রিপোর্ট থেকে বাদ যাবে। এটি আর ফেরানো যাবে না।")}</p>
        <Field id="void-reason" label={tr("বাতিলের কারণ")} placeholder={tr("যেমন: ভুল পণ্য, কাস্টমার ফেরত দিয়েছে")} value={reason} onChange={(e) => setReason(e.target.value)} error={voidError} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setVoidOpen(false)}>
            {tr("না")}
          </Button>
          <Button variant="danger" onClick={confirmVoid}>
            {tr("হ্যাঁ, বাতিল করুন")}
          </Button>
        </div>
      </Sheet>
      <p className="no-print text-center text-sm text-muted">{tr("এই বিল আপাতত এই ফোনেই সেভ আছে।")}</p>
    </AppShell>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ReceiptView />
    </Suspense>
  )
}
