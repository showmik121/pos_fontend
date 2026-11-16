import { cn } from "@/lib/cn"

interface Option<T extends string> {
  value: T
  label: string
}

/** সমান চওড়া বাছাইয়ের বোতাম (radio) */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("h-11 flex-1 rounded-xl px-1.5 text-[15px]", on ? "border-[1.5px] border-brand bg-brand-soft font-semibold text-brand-dark" : "border border-line-strong bg-white font-medium text-ink")}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** গোলাকার ফিল্টার চিপ */
export function Chips<T extends string>({ options, value, onChange }: { options: readonly Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn("h-11 whitespace-nowrap rounded-full px-3.5 text-sm", on ? "border-[1.5px] border-brand bg-brand-soft font-semibold text-brand-dark" : "border border-line-strong bg-white font-medium text-ink")}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
