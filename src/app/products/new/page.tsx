"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ProductForm } from "@/components/product-form"
import { createProduct } from "@/lib/store/actions"
import { afterCreateHref } from "@/lib/store/flow"

function NewProduct() {
  const router = useRouter()
  const params = useSearchParams()
  const { db, run } = useDb()
  return (
    <AppShell title="নতুন পণ্য" backHref={params.get("next") === "stock" ? "/stock/in" : "/stock"}>
      <ProductForm
        initialBarcode={params.get("barcode") ?? ""}
        defaultMinStock={db.settings.defaultMinStock}
        submitLabel={params.get("next") === "stock" ? "সেভ করে স্টক যোগ করুন" : "পণ্য সেভ করুন"}
        onSubmit={(input) => {
          const product = run((d) => {
            const out = createProduct(d, input, new Date())
            return { db: out.db, value: out.product }
          })
          router.replace(afterCreateHref(params.get("next"), product.id))
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
