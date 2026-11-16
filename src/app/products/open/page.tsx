"use client"

import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ProductForm } from "@/components/product-form"
import { createProduct } from "@/lib/store/actions"

export default function OpenProductPage() {
  const router = useRouter()
  const { db, run } = useDb()
  return (
    <AppShell title="খোলা পণ্য" backHref="/stock">
      <ProductForm
        open
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
