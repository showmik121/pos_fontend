"use client"

import { tr } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ProductForm } from "@/components/product-form"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { createProduct, stockIn } from "@/lib/store/actions"
import { afterCreateHref } from "@/lib/store/flow"
import { findProduct } from "@/lib/store/selectors"

function NewProduct() {
  const router = useRouter()
  const params = useSearchParams()
  const { db, run } = useDb()
  const { isPharmacy } = useSessionInfo()
  // ?from=<id>: সেই পণ্যের নাম/দাম ভরা ফর্মে আরেকটি ভ্যারিয়েন্ট যোগ
  const fromId = params.get("from")
  const template = fromId ? findProduct(db, fromId) : undefined
  return (
    <AppShell title={tr("নতুন পণ্য")} backHref={params.get("next") === "stock" ? "/stock/in" : "/stock"}>
      <ProductForm
        key={fromId ?? "new"}
        prefill={template}
        initialBarcode={params.get("barcode") ?? ""}
        defaultMinStock={db.settings.defaultMinStock}
        submitLabel={tr("পণ্য সেভ করুন")}
        withInitialStock
        showExpiry={isPharmacy}
        pharmacy={isPharmacy}
        onSubmit={(input, stock, addAnother) => {
          const product = run((d) => {
            const now = new Date()
            const out = createProduct(d, input, now)
            // শুরুর স্টক দিলে একই ধাপে ব্যাচ হয়ে যায় (ব্যাচ নম্বর/মেয়াদ ঐচ্ছিক)
            const next = stock.qty > 0
              ? stockIn(out.db, { productId: out.product.id, qty: stock.qty, unit: "piece", batchNo: "", expiryDate: stock.expiryDate, costPoisha: input.costPoisha, pricePoisha: null, requireBatchAndExpiry: false }, now)
              : out.db
            return { db: next, value: { id: out.product.id, stocked: stock.qty > 0 } }
          })
          router.replace(addAnother ? `/products/new?from=${product.id}` : afterCreateHref(product.stocked ? null : params.get("next"), product.id))
        }}
      />
    </AppShell>
  )
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<Splash />}>
      <NewProduct />
    </Suspense>
  )
}
