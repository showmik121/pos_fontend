import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "./icons"

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card-surface overflow-hidden rounded-2xl border border-line/80 bg-white", className)}>{children}</div>
}

/** সারিগুলোর কার্ড: মাঝে পাতলা দাগ */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("divide-y divide-line", className)}>{children}</Card>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-1 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink"><span aria-hidden="true" className="h-4 w-1 rounded-full bg-gold" />{children}</h2>
      {right}
    </div>
  )
}

type Tone = "brand" | "warn" | "danger" | "neutral"
const PILL: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-dark",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-chip text-chip-ink",
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium", PILL[tone])}>{children}</span>
}

export type DotTone = "amber" | "danger" | "muted" | "brand"
const DOT: Record<DotTone, string> = { amber: "bg-amber", danger: "bg-danger", muted: "bg-muted", brand: "bg-brand" }

interface RowProps {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  dot?: DotTone
  href?: string
  onClick?: () => void
  chevron?: boolean
  className?: string
  tall?: boolean
}

/** তালিকার একটি সারি: বামে নাম/উপশিরোনাম, ডানে মান বা ট্যাগ */
export function Row({ title, subtitle, right, dot, href, onClick, chevron, className, tall }: RowProps) {
  const inner = (
    <>
      {dot ? <span className={cn("size-2 flex-none rounded-full", DOT[dot])} /> : null}
      <div className="min-w-0 flex-1">
        <div className="font-medium leading-snug">{title}</div>
        {subtitle ? <div className="text-[13px] leading-snug text-muted">{subtitle}</div> : null}
      </div>
      {right || chevron ? (
        <div className="flex flex-none items-center gap-2">
          {right}
          {chevron ? <Icon name="chevron" size={18} className="text-muted" /> : null}
        </div>
      ) : null}
    </>
  )
  const cls = cn("flex w-full items-center gap-3 px-4 py-1.5 text-left", tall ? "min-h-[60px]" : "min-h-[54px]", (href || onClick) && "active:bg-canvas", className)
  if (href) return <Link href={href} className={cls}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

/** বাম লেবেল, ডান মান (হিসাবের লাইন) */
export function KeyValue({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4", strong ? "min-h-[52px]" : "min-h-11")}>
      <span className={strong ? "font-semibold" : "font-medium"}>{label}</span>
      <span className={strong ? "text-lg font-semibold" : ""}>{value}</span>
    </div>
  )
}

export function StatBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="flex-1">
      <div className="border-l-4 border-gold px-3.5 py-3">
        <div className="text-[13px] text-muted">{label}</div>
        <div className="text-[22px] font-bold leading-snug text-brand-dark">{value}</div>
      </div>
    </Card>
  )
}
