"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AppShell, Ready } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, KeyValue, RowList } from "@/components/ui/card"
import { AmountInput } from "@/components/ui/inputs"
import { Segmented } from "@/components/ui/segmented"
import { computeCart, type BillDiscount } from "@/lib/domain/cart"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka, parseTaka, takaInputValue } from "@/lib/domain/money"
import { setBillDiscount, setLineDiscounts } from "@/lib/store/actions"
import { findProduct } from "@/lib/store/selectors"

type Kind = "amount" | "percent"
const KINDS = [
  { value: "amount", label: "৳ টাকা" },
  { value: "percent", label: "% শতাংশ" },
] as const

function DiscountScreen() {
  const { db, update } = useDb()
  const router = useRouter()
  const lines = db.draft.lines.flatMap((l) => {
    const product = findProduct(db, l.productId)
    return product ? [{ line: l, product }] : []
  })

  const [lineInputs, setLineInputs] = useState<Record<string, string>>(() => Object.fromEntries(lines.map(({ line }) => [line.productId, line.discount ? takaInputValue(line.discount) : ""])))
  const [kind, setKind] = useState<Kind>(db.draft.bill.type)
  const [billInput, setBillInput] = useState(db.draft.bill.value ? takaInputValue(db.draft.bill.value) : "")

  const preview = useMemo(() => {
    const discounts: Record<string, number> = {}
    for (const { line } of lines) {
      const raw = lineInputs[line.productId] ?? ""
      const v = raw.trim() ? parseTaka(raw) : 0
      if (v == null) return { error: "ছাড়ের পরিমাণ সঠিক নয়" as const }
      discounts[line.productId] = v
    }
    const billValue = billInput.trim() ? parseTaka(billInput) : 0
    if (billValue == null) return { error: "বিলের ছাড় সঠিক নয়" as const }
    const bill: BillDiscount = { type: kind, value: billValue }
    try {
      const totals = computeCart(
        lines.map(({ line, product }) => ({ unitPrice: product.pricePoisha, qty: line.qty, discount: discounts[line.productId] ?? 0 })),
        bill,
      )
      return { totals, discounts, bill }
    } catch (err) {
      return { error: domainMessage(err) }
    }
  }, [lines, lineInputs, kind, billInput])

  const apply = () => {
    if ("error" in preview) return
    update((d) => ({ ...d, draft: setBillDiscount(setLineDiscounts(d.draft, preview.discounts), preview.bill) }))
    router.push("/sell")
  }

  const clear = () => {
    update((d) => ({ ...d, draft: setBillDiscount(setLineDiscounts(d.draft, Object.fromEntries(lines.map(({ line }) => [line.productId, 0]))), { type: "amount", value: 0 }) }))
    router.push("/sell")
  }

  return (
    <AppShell
      title="ছাড়"
      backHref="/sell"
      footer={
        <div className="space-y-2">
          {"totals" in preview ? (
            <div className="flex items-center justify-between">
              <span className="text-muted">ছাড়ের পর মোট</span>
              <span className="text-xl font-bold">{formatTaka(preview.totals.total)}</span>
            </div>
          ) : null}
          <Button full onClick={apply} disabled={"error" in preview}>
            ছাড় প্রয়োগ করুন
          </Button>
        </div>
      }
    >
      {lines.length === 0 ? <Banner tone="warn">বিলে কোনো পণ্য নেই।</Banner> : null}
      {"error" in preview ? <Banner tone="danger">{preview.error}</Banner> : null}

      <h2 className="text-[15px] font-semibold">পণ্য ধরে ছাড় (মোট টাকা)</h2>
      <RowList>
        {lines.map(({ line, product }) => (
          <div key={product.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <div className="truncate font-medium">{product.name}</div>
              <div className="text-[13px] text-muted">{formatTaka(product.pricePoisha * line.qty)}</div>
            </div>
            <AmountInput id={`d-${product.id}`} label={`${product.name}-এর ছাড়`} placeholder="০" value={lineInputs[product.id] ?? ""} onChange={(e) => setLineInputs((p) => ({ ...p, [product.id]: e.target.value }))} />
          </div>
        ))}
      </RowList>

      <h2 className="text-[15px] font-semibold">পুরো বিলে ছাড়</h2>
      <Card className="space-y-3 p-4">
        <Segmented label="ছাড়ের ধরন" options={KINDS} value={kind} onChange={setKind} />
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{kind === "amount" ? "ছাড় (৳)" : "ছাড় (%)"}</span>
          <AmountInput id="bill-discount" label="বিলের ছাড়" placeholder="০" value={billInput} onChange={(e) => setBillInput(e.target.value)} />
        </div>
      </Card>

      {"totals" in preview ? (
        <RowList>
          <KeyValue label="ছাড়ের আগে" value={formatTaka(preview.totals.subtotal)} />
          <KeyValue label="পণ্যের ছাড়" value={`−${formatTaka(preview.totals.lineDiscount)}`} />
          <KeyValue label="বিলের ছাড়" value={`−${formatTaka(preview.totals.billDiscount)}`} />
        </RowList>
      ) : null}

      <Button variant="ghost" full onClick={clear}>
        সব ছাড় সরান
      </Button>
    </AppShell>
  )
}

export default function DiscountPage() {
  return (
    <Ready>
      <DiscountScreen />
    </Ready>
  )
}
