import type { ReactNode } from "react"
import { productDetailLine } from "@/lib/store/search"
import type { Product } from "@/lib/store/types"

/** তালিকার সারির উপশিরোনাম: ওষুধের তথ্য (জেনেরিক, শক্তি, ধরন, কোম্পানি) থাকলে ওপরে, নিচে `rest` */
export function withDetail(product: Product, rest: ReactNode): ReactNode {
  const detail = productDetailLine(product)
  if (!detail) return rest
  return (
    <>
      <span className="block text-ink/80">{detail}</span>
      {rest}
    </>
  )
}
