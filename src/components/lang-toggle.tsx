"use client"

import { useLang } from "@/components/lang-provider"
import type { Lang } from "@/lib/i18n"

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "bn", label: "বাংলা" },
  { value: "en", label: "English" },
]

/** লগইন, সাইনআপ ও ল্যান্ডিংয়ের ছোট ভাষা-বদল বোতাম (ভেতরের পাতায় সেটিংস ব্যবহার হয়) */
export function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div role="group" aria-label="ভাষা / Language" className="inline-flex rounded-xl border border-line bg-white p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          onClick={() => setLang(o.value)}
          className={`min-h-10 rounded-[10px] px-3 text-[14px] font-semibold ${
            lang === o.value ? "bg-brand text-white" : "text-muted active:bg-brand-soft"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
