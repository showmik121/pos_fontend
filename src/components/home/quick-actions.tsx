import Link from "next/link"
import { cn } from "@/lib/cn"
import { tr } from "@/lib/i18n"
import { STICKER_ICONS, type StickerName } from "@/components/ui/sticker-icons"

export type QuickTone = "gold" | "plum" | "green"

/** কার্ডের কোণের নরম আভা (ছবির রঙের পরিবার) */
const GLOW: Record<QuickTone, string> = {
  gold: "rgb(255 200 61 / 0.26)",
  plum: "rgb(217 163 204 / 0.26)",
  green: "rgb(169 211 154 / 0.32)",
}

export interface QuickAction {
  key: string
  href: string
  icon: StickerName
  tone: QuickTone
  label: string
  subtitle: string
  /** কোণের লাল সংখ্যা; শুধু খবর থাকলে */
  count?: string
}

function ActionCard({ a, wide }: { a: QuickAction; wide: boolean }) {
  const Art = STICKER_ICONS[a.icon]
  return (
    <li className={cn(wide && "col-span-2")}>
      <Link
        href={a.href}
        className="press relative isolate flex h-[76px] items-center overflow-hidden rounded-2xl border border-line/60 bg-white py-3 pl-3.5 pr-[72px] shadow-[0_1px_2px_rgb(107_68_35/0.05),0_10px_20px_-14px_rgb(107_68_35/0.28)]"
      >
        <span aria-hidden="true" className="absolute right-0 top-1/2 size-28 -translate-y-1/2 translate-x-4 rounded-full" style={{ background: `radial-gradient(closest-side, ${GLOW[a.tone]}, transparent)` }} />
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 size-14 -translate-y-1/2">
          <Art />
        </span>
        {a.count ? (
          <span className="absolute right-2 top-2 min-w-[18px] rounded-full bg-alert px-1 text-center text-[10.5px] font-extrabold leading-[18px] text-white ring-2 ring-white">{a.count}</span>
        ) : null}
        <span className="relative min-w-0 leading-tight">
          <span className="block text-[15px] font-bold text-ink">{a.label}</span>
          <span className="mt-0.5 block text-[11.5px] font-medium text-muted">{a.subtitle}</span>
        </span>
      </Link>
    </li>
  )
}

/** দ্রুত কাজ: নিচের মেনুতে যা নেই সেগুলোই; ছোট সমান কার্ড, নাম ও ব্যাখ্যা বামে, ছোট ত্রিমাত্রিক ছবি ডানে */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null
  return (
    <section aria-label={tr("দ্রুত কাজ")}>
      <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-ink">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-gold" />
        {tr("দ্রুত কাজ")}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5">
        {actions.map((a, i) => (
          <ActionCard key={a.key} a={a} wide={actions.length % 2 === 1 && i === actions.length - 1} />
        ))}
      </ul>
    </section>
  )
}
