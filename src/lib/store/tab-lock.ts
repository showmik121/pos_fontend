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
  /** ব্রাউজারে Web Locks নেই: আটকানোর উপায় নেই, আগের আচরণে (সবাই লেখে) চলে */
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
 * দোকান-ভিত্তিক একক "লেখক" লক। দুটি ট্যাব একসাথে বিক্রি করলে প্রতিটি সেভে পুরো ডেটা লেখা হয় বলে একটির বিল অন্যটি ঘষে দিত;
 * তাই একসময়ে একটি ট্যাবই লিখতে পারে, অন্যটি reader। `steal` দিলে লক কেড়ে নেয় (ব্যবহারকারী "এই ট্যাবে কাজ করুন" চাপলে);
 * তখন আগের ট্যাবের `onLost` ডাকা হয়। লক ট্যাব বন্ধ হলে ব্রাউজার নিজে ছাড়ে।
 */
export function acquireWriter(opts: { storeId: string; locks?: LockManagerLike | null; onLost: () => void; steal?: boolean }): Promise<WriterResult> {
  const locks = opts.locks === undefined ? browserLocks() : opts.locks
  if (!locks) return Promise.resolve({ status: "unsupported" })
  return new Promise<WriterResult>((resolve) => {
    let release: () => void = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    locks
      .request(`pos-writer-${opts.storeId}`, opts.steal ? { mode: "exclusive", steal: true } : { mode: "exclusive", ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve({ status: "reader" })
          return
        }
        resolve({ status: "writer", release })
        return held // ছাড়া বা ট্যাব বন্ধ পর্যন্ত ধরে রাখি
      })
      .catch(() => {
        // অন্য ট্যাব লক কেড়ে নিয়েছে (AbortError) বা লক ব্যর্থ: আমরা আর লেখক নই
        opts.onLost()
        resolve({ status: "reader" })
      })
  })
}
