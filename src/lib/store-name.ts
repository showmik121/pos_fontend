export const STORE_NAME_MAX = 120

/** দোকানের নামের যাচাই: ছাঁটা নাম ফেরায়; খালি বা বেশি লম্বা হলে null (সার্ভারের সীমার সাথে মেলানো) */
export function cleanStoreName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ")
  return name.length > 0 && name.length <= STORE_NAME_MAX ? name : null
}
