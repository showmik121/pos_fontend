/** স্ক্যান-করে-নতুন-পণ্য প্রবাহের লিংক (বিশুদ্ধ, টেস্টযোগ্য) */

/** স্টক-জমা পেজে না-পাওয়া বারকোড → নতুন পণ্য ফর্ম (বারকোড ভরা), সেভের পর স্টকে ফেরা */
export function newProductFromScanHref(barcode: string): string {
  return `/products/new?barcode=${encodeURIComponent(barcode)}&next=stock`
}

/** নতুন পণ্য বানানোর পর কোথায় যাবে। শুধু চেনা মান মানা হয়, অন্য কিছু এলে আগের আচরণ */
export function afterCreateHref(next: string | null, productId: string): string {
  if (next === "stock") return `/stock/in?product=${encodeURIComponent(productId)}`
  return `/products/detail?id=${encodeURIComponent(productId)}`
}
