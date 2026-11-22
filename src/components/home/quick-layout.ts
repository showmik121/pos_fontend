const GRID_COLUMNS = 6

/** ছোট কার্ডের কলাম-দখল (৬-ঘরের গ্রিডে): সাধারণত ৩টি করে সারি; ১, ২ বা ৪টি বাকি থাকলে সারি ভরাট রাখতে চওড়া */
export function smallSpans(n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [GRID_COLUMNS]
  const rest = n % 3
  if (rest === 0) return Array<number>(n).fill(2)
  const wide = rest === 2 ? 2 : 4
  return [...Array<number>(n - wide).fill(2), ...Array<number>(wide).fill(3)]
}
