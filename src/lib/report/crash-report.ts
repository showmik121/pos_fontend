export type CrashKind = "render" | "window" | "rejection"

export interface CrashReport {
  kind: CrashKind
  message: string
  stack: string | null
  path: string
  appVersion: string
}

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">

const MAX_MESSAGE = 500
const MAX_STACK = 4000
const MAX_PER_SESSION = 3
const SESSION_KEY = "pos.crash.sent.v1"

/** ফোন/টাকার মতো বড় সংখ্যা (ইংরেজি বা বাংলা অঙ্কে) রিপোর্টে যায় না */
const scrub = (s: string) => s.replace(/[\d\u09E6-\u09EF]{6,}/g, "#")

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name
  if (typeof err === "string") return err
  if (err === null || err === undefined) return "অজানা ত্রুটি"
  try {
    return JSON.stringify(err) ?? "অজানা ত্রুটি"
  } catch {
    return "অজানা ত্রুটি"
  }
}

/** ত্রুটি থেকে পাঠানোর রিপোর্ট: বার্তা ও স্ট্যাক ছাঁটা, পথ থেকে `?`/`#` কাটা। ডেটার কিছু (বিল, পণ্য) এতে ঢোকে না। */
export function buildReport(kind: CrashKind, err: unknown, ctx: { path: string; appVersion: string }): CrashReport {
  const message = scrub(messageOf(err)).slice(0, MAX_MESSAGE) || "অজানা ত্রুটি"
  const stack = err instanceof Error && err.stack ? scrub(err.stack).slice(0, MAX_STACK) : null
  return { kind, message, stack, path: (ctx.path.split(/[?#]/)[0] ?? "/").slice(0, 200) || "/", appVersion: ctx.appVersion }
}

const HARMLESS = /^(ResizeObserver loop|Script error\.?)/

/** ব্রাউজার-নিরীহ বার্তা, এক্সটেনশন বা অন্য সাইটের স্ক্রিপ্টের ত্রুটি (আমাদের কোডের নয়) */
export function isNoise(message: string, filename: string | undefined, origin: string): boolean {
  if (HARMLESS.test(message)) return true
  return filename !== undefined && filename !== "" && !filename.startsWith(origin)
}

/** একই সেশনে একই ত্রুটি একবার, মোট সর্বোচ্চ ৩টি (ঝড় ঠেকাতে)। সার্ভারেও সীমা আছে। */
export function shouldSend(fingerprint: string, storage: KeyValueStorage | null, _now: number): boolean {
  let sent: string[] = []
  try {
    const raw = storage?.getItem(SESSION_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) sent = parsed.filter((x): x is string => typeof x === "string")
  } catch {
    sent = []
  }
  if (sent.includes(fingerprint) || sent.length >= MAX_PER_SESSION) return false
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify([...sent, fingerprint]))
  } catch {
    // স্টোরেজ বন্ধ: তবু একবার পাঠানো চলবে
  }
  return true
}

export const fingerprintOf = (r: CrashReport) => `${r.kind}|${r.message}|${(r.stack ?? "").slice(0, 200)}`
