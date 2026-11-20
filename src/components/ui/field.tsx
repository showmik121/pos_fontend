import type { InputHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/cn"

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  hint?: string
  error?: string | null
  trailing?: ReactNode
  /** ঘরের বাঁ পাশের ছোট আইকন */
  leading?: ReactNode
}

export function Field({ id, label, hint, error, trailing, leading, className, ...input }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {leading ? (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-brand">
            {leading}
          </span>
        ) : null}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
          className={cn(
            "min-h-12 w-full rounded-xl border bg-white px-3 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-2 focus:outline-brand/30",
            error ? "border-danger" : "border-line-strong",
            trailing ? "pr-20" : "",
            leading ? "pl-11" : "",
            className,
          )}
        />
        {trailing ? <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
