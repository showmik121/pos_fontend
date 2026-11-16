import { toBanglaDigits } from "@/lib/format/bn"
import { cn } from "@/lib/cn"

export function Stepper({ value, onChange, min = 0, size = 44, wide = false }: { value: number; onChange: (v: number) => void; min?: number; size?: 44 | 48; wide?: boolean }) {
  const box = size === 48 ? "size-12" : "size-11"
  return (
    <div className={cn("flex items-center gap-1", wide && "gap-2")}>
      <button type="button" aria-label="কমান" disabled={value <= min} onClick={() => onChange(value - 1)} className={cn(box, "rounded-xl border border-line-strong bg-white text-xl disabled:text-muted")}>
        −
      </button>
      <div className={cn("text-center text-base font-semibold", wide ? "flex-1 text-xl" : "w-12")}>{toBanglaDigits(value)}</div>
      <button type="button" aria-label="বাড়ান" onClick={() => onChange(value + 1)} className={cn(box, "rounded-xl border border-line-strong bg-white text-xl")}>
        +
      </button>
    </div>
  )
}
