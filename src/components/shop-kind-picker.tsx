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

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={cn("grid size-6 flex-none place-items-center rounded-full border-2 transition-colors", on ? "border-brand bg-brand text-white" : "border-line-strong bg-white")}>
      {on ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </span>
  )
}

/** দোকানের ধরন বাছাই: তিনটি পূর্ণ-প্রস্থ কার্ড, বড় ট্যাপ জায়গা, তীরচিহ্ন-কী দিয়ে চলে। */
export function ShopKindPicker({ value, onChange }: { value: StoreKind; onChange: (kind: StoreKind) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

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
    <div role="radiogroup" aria-label={tr("দোকানের ধরন")} className="space-y-2.5">
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
              "flex min-h-[88px] w-full items-center gap-3.5 rounded-2xl border-[1.5px] p-3 text-left transition-[background-color,border-color,box-shadow] duration-150 active:bg-canvas",
              on ? "border-brand bg-brand-soft shadow-[0_6px_16px_-8px_rgb(46_107_58/0.55)]" : "border-line bg-white",
            )}
          >
            <span className={cn("grid size-[68px] flex-none place-items-center rounded-[18px] bg-gradient-to-br", o.tile)}>{o.art}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold leading-tight text-ink">{tr(o.label)}</span>
              <span className="mt-0.5 block text-pretty text-[13px] leading-snug text-muted">{tr(o.hint)}</span>
            </span>
            <Check on={on} />
          </button>
        )
      })}
    </div>
  )
}
