import type { ReactNode } from "react"
import { tr } from "@/lib/i18n"
import { cn } from "@/lib/cn"
import type { PayMethod } from "@/lib/domain/pay-entry"

interface MethodLook {
  label: string
  /** গোল চিহ্নের রং; লোগো নকল না করে শুধু চেনা রঙে অক্ষর */
  color: string
  glyph: ReactNode
}

const LOOK: Record<PayMethod, MethodLook> = {
  cash: {
    label: "ক্যাশ",
    color: "#2e6b3a",
    glyph: (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
        <circle cx="12" cy="12" r="2.4" />
      </svg>
    ),
  },
  bkash: { label: "বিকাশ", color: "#d6246e", glyph: <span className="text-[17px] font-bold leading-none">b</span> },
  nagad: { label: "নগদ", color: "#ee7a1c", glyph: <span className="text-[17px] font-bold leading-none">N</span> },
  rocket: { label: "রকেট", color: "#7c3a9b", glyph: <span className="text-[17px] font-bold leading-none">R</span> },
}

/** মাধ্যমের নাম (রসিদ/রিপোর্টের মতোই) */
export function methodLabel(method: PayMethod): string {
  return tr(LOOK[method].label)
}

/** ক্যাশ / বিকাশ / নগদ — তিনটি বড় ট্যাপ-টাইল (radio) */
export function MethodTiles({ options, value, onChange, label }: { options: readonly PayMethod[]; value: PayMethod; onChange: (m: PayMethod) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2.5">
      {options.map((m) => {
        const on = m === value
        const look = LOOK[m]
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m)}
            className={cn(
              "press flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[14px]",
              on ? "border-2 border-brand bg-brand-soft font-bold text-brand-dark shadow-[0_4px_12px_-6px_rgba(46,107,58,0.55)]" : "border border-line-strong/70 bg-white font-medium text-ink",
            )}
          >
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full text-white" style={{ backgroundColor: look.color }}>
              {look.glyph}
            </span>
            {tr(look.label)}
          </button>
        )
      })}
    </div>
  )
}
