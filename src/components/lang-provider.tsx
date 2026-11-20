"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { readStoredLang, setCurrentLang, storeLang, type Lang } from "@/lib/i18n"

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error("useLang অবশ্যই LangProvider-এর ভেতরে ব্যবহার করতে হবে")
  return ctx
}

/**
 * ভাষা বদলালে ভেতরের গাছ নতুন key-তে আবার আঁকা হয় (সব `tr()` নতুন ভাষায় চলে)।
 * সংরক্ষিত ভাষা প্রথম আঁকার পরে পড়া হয়, যাতে সার্ভারের HTML-এর সাথে মিলে যায়।
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn")

  useEffect(() => {
    const stored = readStoredLang()
    if (stored !== "bn") {
      setCurrentLang(stored)
      setLangState(stored)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next)
    storeLang(next)
    setLangState(next)
  }, [])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return (
    <LangContext.Provider value={value}>
      <div key={lang} className="contents">
        {children}
      </div>
    </LangContext.Provider>
  )
}
