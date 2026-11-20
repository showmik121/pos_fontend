"use client"

import { tr } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ProductForm } from "@/components/product-form"
import { Banner } from "@/components/ui/banner"
import { updateProduct } from "@/lib/store/actions"
import { findProduct } from "@/lib/store/selectors"

function EditProduct() {
  const router = useRouter()
  const id = useSearchParams().get("id")
  const { db, update } = useDb()
  const product = id ? findProduct(db, id) : undefined
  return (
    <AppShell title={tr("পণ্য সম্পাদনা")} backHref={id ? `/products/detail?id=${id}` : "/stock"}>
      {product ? (
        <ProductForm
          key={product.id}
          initial={product}
          defaultMinStock={db.settings.defaultMinStock}
          submitLabel={tr("পরিবর্তন সেভ করুন")}
          onSubmit={(input) => {
            update((d) => updateProduct(d, product.id, input))
            router.replace(`/products/detail?id=${product.id}`)
          }}
        />
      ) : (
        <Banner tone="warn">{tr("পণ্যটি পাওয়া যায়নি।")}</Banner>
      )}
    </AppShell>
  )
}

export default function EditProductPage() {
  return (
    <Suspense fallback={<Splash />}>
      <EditProduct />
    </Suspense>
  )
}
