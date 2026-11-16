"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, KeyValue } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { formatTaka } from "@/lib/domain/money"
import { formatDateTimeBn } from "@/lib/format/datetime"
import { toBanglaDigits } from "@/lib/format/bn"
import type { Sale } from "@/lib/store/types"

const METHOD_LABEL = { cash: "ক্যাশ", bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট" } as const

function receiptText(storeName: string, sale: Sale): string {
  const rows = sale.lines.map((l) => `${l.name} × ${toBanglaDigits(l.qty)} = ${formatTaka(l.unitPrice * l.qty - l.discount)}`)
  const out = [storeName, `বিল নং ${toBanglaDigits(sale.no)} · ${formatDateTimeBn(sale.at)}`, "", ...rows, ""]
  if (sale.lineDiscount + sale.billDiscount > 0) out.push(`ছাড়: −${formatTaka(sale.lineDiscount + sale.billDiscount)}`)
  out.push(`মোট: ${formatTaka(sale.total)}`)
  for (const p of sale.payments) out.push(`${METHOD_LABEL[p.method]}: ${formatTaka(p.amount)}`)
  if (sale.change > 0) out.push(`ফেরত: ${formatTaka(sale.change)}`)
  if (sale.due > 0) out.push(`বাকি: ${formatTaka(sale.due)}`)
  out.push("", "ধন্যবাদ!")
  return out.join("\n")
}

function ReceiptView() {
  const params = useSearchParams()
  const id = params.get("id")
  const { db } = useDb()
  const { storeName } = useSessionInfo()
  const [note, setNote] = useState<string | null>(null)
  const sale = db.sales.find((s) => s.id === id)

  if (!sale) {
    return (
      <AppShell title="রসিদ" backHref="/">
        <Banner tone="warn">এই বিলটি পাওয়া যায়নি।</Banner>
        <LinkButton href="/sell" full>
          নতুন বিল
        </LinkButton>
      </AppShell>
    )
  }

  const share = async () => {
    const text = receiptText(storeName, sale)
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setNote("রসিদের লেখা কপি হয়েছে — মেসেজে পেস্ট করে পাঠান।")
    } catch {
      // শেয়ার বাতিল করলে কিছু করার নেই
    }
  }

  return (
    <AppShell
      title={`বিল #${toBanglaDigits(sale.no)}`}
      backHref="/"
      footer={
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={share}>
            <Icon name="share" /> শেয়ার
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="print" /> প্রিন্ট
          </Button>
          <LinkButton href="/sell">নতুন বিল</LinkButton>
        </div>
      }
    >
      <Banner tone="info">বিল সম্পন্ন হয়েছে।</Banner>
      <Card>
        <div className="space-y-1 px-4 py-4 text-center">
          <div className="text-lg font-bold">{storeName}</div>
          <div className="text-sm text-muted">
            বিল নং {toBanglaDigits(sale.no)} · {formatDateTimeBn(sale.at)}
          </div>
          {sale.customerName ? <div className="text-sm text-muted">কাস্টমার: {sale.customerName}</div> : null}
        </div>
        <div className="divide-y divide-line border-t border-line">
          {sale.lines.map((l) => (
            <div key={l.productId} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="font-medium">{l.name}</div>
                <div className="text-[13px] text-muted">
                  {formatTaka(l.unitPrice)} × {toBanglaDigits(l.qty)}
                  {l.discount > 0 ? ` · ছাড় −${formatTaka(l.discount)}` : ""}
                </div>
              </div>
              <div className="font-medium">{formatTaka(l.unitPrice * l.qty - l.discount)}</div>
            </div>
          ))}
        </div>
        <div className="divide-y divide-line border-t border-line">
          {sale.lineDiscount + sale.billDiscount > 0 ? <KeyValue label="মোট ছাড়" value={`−${formatTaka(sale.lineDiscount + sale.billDiscount)}`} /> : null}
          <KeyValue label="মোট" value={formatTaka(sale.total)} strong />
          {sale.payments.map((p) => (
            <KeyValue key={p.method} label={METHOD_LABEL[p.method]} value={formatTaka(p.amount)} />
          ))}
          {sale.change > 0 ? <KeyValue label="ফেরত" value={formatTaka(sale.change)} /> : null}
          {sale.due > 0 ? <KeyValue label="বাকি" value={formatTaka(sale.due)} /> : null}
        </div>
      </Card>
      {note ? <Banner tone="info">{note}</Banner> : null}
      <p className="no-print text-center text-sm text-muted">এই বিল আপাতত এই ফোনেই সেভ আছে।</p>
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
