import { EN } from "./en"

export type Lang = "bn" | "en"

export const LANG_STORAGE_KEY = "pos.lang.v1"

/** চলতি ভাষা। মডিউল-স্তরের মান, যাতে কম্পোনেন্টের বাইরের কোড (ত্রুটির বার্তা, ফরম্যাট) ও একই ভাষা পায়; বদলালে গাছ আবার আঁকা হয় */
let current: Lang = "bn"

export const getLang = (): Lang => current
export const setCurrentLang = (lang: Lang): void => {
  current = lang
}

/** বাংলা লেখাকে চলতি ভাষায়। ইংরেজিতে অনুবাদ না থাকলে বাংলাই থাকে (কিছু ভাঙে না) */
export function tr(bn: string): string {
  return current === "en" ? (EN[bn] ?? bn) : bn
}

/** {নাম} বসানো টেমপ্লেট: tf("{n}টি বিল", { n: 3 }) — সংখ্যা চলতি ভাষার অঙ্কে */
export function tf(bn: string, params: Record<string, string | number | null | undefined>): string {
  return tr(bn).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""))
}

export function readStoredLang(): Lang {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY) === "en" ? "en" : "bn"
  } catch {
    return "bn"
  }
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // সংরক্ষণ না হলেও এই সেশনে ভাষা বদলায়
  }
}
