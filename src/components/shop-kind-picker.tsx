"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { CosmeticsArt, PharmacyArt, RetailArt } from "@/components/shop-kind-art"
import type { StoreKind } from "@/lib/api/schemas"
import { cn } from "@/lib/cn"
import { tr } from "@/lib/i18n"

type Option = { value: StoreKind; label: string; hint: string; art: ReactNode; tile: string }

// তিনটি বিকল্প: ফার্মেসি (`pharmacy`), কসমেটিক্স (`cosmetics`), রিটেইল (`other`)।
const OPTIONS: Option[] = [
  { value: "pharmacy", label: "ফার্মেসি", hint: "ওষুধ — ব্যাচ ও মেয়াদের হিসাবসহ", art: <PharmacyArt />, tile: "from-[#e6f2df] to-[#cfe5c8]" },
  { value: "cosmetics", label: "কসমেটিক্স", hint: "মেকআপ, স্কিনকেয়ার, বিউটি পণ্য", art: <CosmeticsArt />, tile: "from-[#fde7ec] to-[#f9cdd8]" },
  { value: "other", label: "রিটেইল", hint: "কাপড়, মুদি, জেনারেল স্টোর ইত্যাদি", art: <RetailArt />, tile: "from-[#fff0c2] to-[#ffdf86]" },
]

function Check() {
  return (
    <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-brand text-white shadow-sm">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  )
}

/**
 * দোকানের ধরন বাছাই: পাশাপাশি তিনটি কমপ্যাক্ট কার্ড (মোবাইলে উচ্চতা কম)।
 * বাছা ধরনের এক লাইনের বর্ণনা গ্রিডের নিচে দেখায়। তীরচিহ্ন-কী দিয়ে চলে।
 */
export function ShopKindPicker({ value, onChange }: { value: StoreKind; onChange: (kind: StoreKind) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selected = OPTIONS.find((o) => o.value === value)

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0
    if (step === 0) return
    e.preventDefault()
    const next = (index + step + OPTIONS.length) % OPTIONS.length
    const option = OPTIONS[next]
    if (!option) return
    onChange(option.value)
    refs.current[next]?.focus()
  }

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={tr("দোকানের ধরন")} className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o, i) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={tr(o.label)}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] px-1.5 pb-2.5 pt-2.5 transition-[background-color,border-color,box-shadow] duration-150 active:bg-canvas",
                on ? "border-brand bg-brand-soft shadow-[0_6px_14px_-8px_rgb(46_107_58/0.55)]" : "border-line bg-white",
              )}
            >
              <span className={cn("grid size-[58px] place-items-center rounded-[16px] bg-gradient-to-br [&>svg]:size-[52px]", o.tile)}>{o.art}</span>
              <span className="text-[14px] font-bold leading-tight text-ink">{tr(o.label)}</span>
              {on ? <Check /> : null}
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="min-h-5 text-[13px] leading-snug text-muted">
        {selected ? tr(selected.hint) : null}
      </p>
    </div>
  )
}
