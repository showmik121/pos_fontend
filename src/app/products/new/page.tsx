"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ProductForm } from "@/components/product-form"
import { createProduct } from "@/lib/store/actions"

function NewProduct() {
  const router = useRouter()
  const params = useSearchParams()
  const { db, run } = useDb()
  return (
    <AppShell title="নতুন পণ্য" backHref="/stock">
      <ProductForm
        initialBarcode={params.get("barcode") ?? ""}
        defaultMinStock={db.settings.defaultMinStock}
        submitLabel="পণ্য সেভ করুন"
        onSubmit={(input) => {
          const product = run((d) => {
            const out = createProduct(d, input, new Date())
            return { db: out.db, value: out.product }
          })
          router.replace(`/products/detail?id=${product.id}`)
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
