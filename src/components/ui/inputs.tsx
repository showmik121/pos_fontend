import type { InputHTMLAttributes } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "./icons"

/** সার্চ বক্স (ডিজাইনের মতো বামে আইকন) */
export function SearchBox({ id, label, ...rest }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute left-3 top-3.5 text-muted">
        <Icon name="search" />
      </span>
      <input id={id} type="text" {...rest} className={cn("h-12 w-full rounded-xl border border-line-strong bg-white pl-10 pr-3 text-base text-ink placeholder:text-muted/70", rest.className)} />
    </div>
  )
}

/** ছোট ডান-সাজানো সংখ্যার ইনপুট (টাকা/পরিমাণ) */
export function AmountInput({ id, label, className, ...rest }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} inputMode="decimal" {...rest} className={cn("h-11 w-28 rounded-xl border border-line-strong bg-white px-3 text-right text-base text-ink", className)} />
    </>
  )
}
