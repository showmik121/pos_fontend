/** Web Locks API-র যতটুকু ব্যবহার করি (টেস্টে নকল দেওয়া যায়) */
export interface LockManagerLike {
  request(
    name: string,
    options: { mode?: "exclusive"; ifAvailable?: boolean; steal?: boolean },
    callback: (lock: unknown) => Promise<void> | void,
  ): Promise<unknown>
}

export type WriterResult =
  /** এই ট্যাব দোকানের ডেটা লিখতে পারবে; `release` দিলে ছেড়ে দেয় */
  | { status: "writer"; release: () => void }
  /** অন্য ট্যাব লিখছে; এই ট্যাব শুধু দেখতে পারবে */
  | { status: "reader" }
  /** Web Locks নেই বা লক নেওয়া ব্যর্থ: আটকানোর উপায় নেই, আগের আচরণে (সবাই লেখে) চলে */
  | { status: "unsupported" }

export function browserLocks(): LockManagerLike | null {
  try {
    const l = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { locks?: LockManagerLike }).locks
    return l ?? null
  } catch {
    return null
  }
}

/**
 * এই ট্যাবই সদ্য ছেড়েছে এমন লকের "সত্যিই ছাড়া হয়েছে" প্রতিশ্রুতি (দোকান-ভিত্তিক)। `release()` শুধু ধরে-রাখা প্রতিশ্রুতি মুক্ত করে;
 * ব্রাউজার লক ছাড়ে কয়েক ধাপ পরে। তার আগেই নতুন `ifAvailable` অনুরোধ গেলে সে নিজের আগের লককে "অন্যের" ভেবে reader হয়ে যেত
 * (React StrictMode-এর দ্বিতীয় mount, লগআউট-লগইন)। তাই নতুন অনুরোধের আগে এটির জন্য অপেক্ষা করি।
 */
const releasing = new Map<string, Promise<void>>()

const isAbort = (e: unknown): boolean => (e as { name?: unknown } | null)?.name === "AbortError"

/**
 * দোকান-ভিত্তিক একক "লেখক" লক। দুটি ট্যাব একসাথে বিক্রি করলে প্রতিটি সেভে পুরো ডেটা লেখা হয় বলে একটির বিল অন্যটি ঘষে দিত;
 * তাই একসময়ে একটি ট্যাবই লিখতে পারে, অন্যটি reader। `steal` দিলে লক কেড়ে নেয় (ব্যবহারকারী "এই ট্যাবে কাজ করুন" চাপলে);
 * তখন আগের ট্যাবের `onLost` ডাকা হয়। লক ট্যাব বন্ধ হলে ব্রাউজার নিজে ছাড়ে।
 * লক চাওয়াই ব্যর্থ হলে (AbortError ছাড়া) ট্যাবকে reader বানাই না (বিক্রি আটকে যেত): `unsupported` ধরে আগের আচরণে চলে।
 */
export async function acquireWriter(opts: { storeId: string; locks?: LockManagerLike | null; onLost: () => void; steal?: boolean }): Promise<WriterResult> {
  const locks = opts.locks === undefined ? browserLocks() : opts.locks
  if (!locks) return { status: "unsupported" }
  const name = `pos-writer-${opts.storeId}`
  await releasing.get(name)
  return new Promise<WriterResult>((resolve) => {
    let resolveHeld: () => void = () => {}
    const held = new Promise<void>((r) => {
      resolveHeld = r
    })
    let settled: Promise<void> = Promise.resolve()
    const release = () => {
      releasing.set(name, settled)
      resolveHeld()
    }
    settled = locks
      .request(name, opts.steal ? { mode: "exclusive", steal: true } : { mode: "exclusive", ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve({ status: "reader" })
          return
        }
        resolve({ status: "writer", release })
        return held // ছাড়া বা ট্যাব বন্ধ পর্যন্ত ধরে রাখি
      })
      .then(
        () => undefined,
        (e: unknown) => {
          if (isAbort(e)) {
            // অন্য ট্যাব লক কেড়ে নিয়েছে: আমরা আর লেখক নই
            opts.onLost()
            resolve({ status: "reader" })
          } else {
            resolve({ status: "unsupported" })
          }
        },
      )
  })
}
