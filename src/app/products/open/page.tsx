"use client"

import { tr } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ProductForm } from "@/components/product-form"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { createProduct } from "@/lib/store/actions"

export default function OpenProductPage() {
  const router = useRouter()
  const { db, run } = useDb()
  const { isPharmacy } = useSessionInfo()
  return (
    <AppShell title={tr("খোলা পণ্য")} backHref="/stock">
      <ProductForm
        open
        pharmacy={isPharmacy}
        defaultMinStock={db.settings.defaultMinStock}
        submitLabel={tr("পণ্য সেভ করুন")}
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
