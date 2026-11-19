import Link from "next/link"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/cn"

type Variant = "primary" | "secondary" | "danger" | "ghost"

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary-grad text-white",
  secondary: "bg-white text-ink border border-line active:bg-canvas disabled:text-muted",
  danger: "bg-white text-danger border border-danger/40 active:bg-danger-bg disabled:opacity-50",
  ghost: "bg-transparent text-brand active:bg-brand-soft disabled:text-muted",
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  full?: boolean
}

export function Button({ variant = "primary", loading = false, full = false, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition-colors",
        VARIANTS[variant],
        full && "w-full",
        className,
      )}
    >
      {loading ? "অপেক্ষা করুন…" : children}
    </button>
  )
}

/** বোতামের মতো দেখতে লিংক */
export function LinkButton({ href, variant = "primary", full = false, className, children }: { href: string; variant?: Variant; full?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition-colors", VARIANTS[variant], full && "w-full", className)}
    >
      {children}
    </Link>
  )
}
