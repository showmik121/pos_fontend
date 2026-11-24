/** বারকোড স্ক্যানারের ক্যামেরা সেটিং: বিশুদ্ধ ফাংশন, ব্রাউজার ছাড়াই টেস্টযোগ্য। */

/** দোকানের পণ্যে যা থাকে: EAN/UPC, Code 128/39, ITF, QR, DataMatrix */
const PREFERRED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code", "data_matrix"] as const

/** পেছনের ক্যামেরা, ১২৮০×৭২০ পছন্দের (ছোট বারকোড পড়তে বেশি পিক্সেল লাগে) */
export function buildVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }
}

/** ডিভাইস যে ফরম্যাট পারে তার মধ্যে আমাদের পছন্দেরগুলো (গতি বাড়ে); তালিকা না পেলে সবগুলো পছন্দের ফরম্যাট। */
export function pickFormats(supported: readonly string[] | undefined): string[] {
  if (!supported || supported.length === 0) return [...PREFERRED_FORMATS]
  const picked = PREFERRED_FORMATS.filter((f) => supported.includes(f))
  return picked.length > 0 ? picked : [...PREFERRED_FORMATS]
}

interface CapsLike {
  focusMode?: string[]
  zoom?: { min: number; max: number; step: number }
  torch?: boolean
}

/** অটোফোকাস ধারাবাহিক রাখতে চাইলে ট্র্যাকে বসানোর শর্ত; ডিভাইস না পারলে null */
export function focusConstraint(caps: CapsLike): { focusMode: "continuous" } | null {
  return caps.focusMode?.includes("continuous") ? { focusMode: "continuous" } : null
}

/** জুম স্লাইডারের সীমা; জুম না থাকলে (বা min = max) null */
export function zoomRange(caps: CapsLike): { min: number; max: number; step: number } | null {
  const z = caps.zoom
  return z && z.max > z.min ? { min: z.min, max: z.max, step: z.step || 0.1 } : null
}

export function torchSupported(caps: CapsLike): boolean {
  return caps.torch === true
}
