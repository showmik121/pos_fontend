import { toBanglaDigits } from "../format/bn"

/** বিল নম্বর দেখানোর রূপ: ডিভাইস-উপসর্গ থাকলে "A-১০০১", নইলে "১০০১" */
export function formatBillNo(sale: { no: number; prefix?: string }): string {
  const digits = toBanglaDigits(sale.no)
  return sale.prefix ? `${sale.prefix}-${digits}` : digits
}
