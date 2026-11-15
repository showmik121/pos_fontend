import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

type Tone = "info" | "warn" | "danger"

const TONES: Record<Tone, string> = {
  info: "bg-brand-soft text-brand-dark",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
}

export function Banner({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl px-3 py-2.5 text-sm", TONES[tone])}>
      {children}
    </div>
  )
}
