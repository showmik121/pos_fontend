import Link from "next/link"
import { cn } from "@/lib/cn"
import { tr } from "@/lib/i18n"
import { Icon, type IconName } from "@/components/ui/icons"
import { STICKER_ICONS, type StickerName } from "@/components/ui/sticker-icons"
import { smallSpans } from "./quick-layout"

export type QuickTone = "coral" | "gold" | "teal" | "plum" | "green"

/** কার্ডের পেছনের নরম আভা (ছবির রঙের পরিবার) */
const GLOW: Record<QuickTone, string> = {
  coral: "rgb(245 166 136 / 0.32)",
  gold: "rgb(255 200 61 / 0.34)",
  teal: "rgb(143 208 204 / 0.38)",
  plum: "rgb(217 163 204 / 0.34)",
  green: "rgb(169 211 154 / 0.4)",
}

export interface QuickAction {
  key: string
  href: string
  icon: StickerName
  tone: QuickTone
  label: string
  /** বড় কার্ডে নামের নিচে এক লাইনের ব্যাখ্যা */
  subtitle?: string
  /** বড় কার্ডের ওপরে ট্যাগ (আইকনসহ); শুধু খবর থাকলে */
  badge?: { text: string; icon: IconName }
  /** ছোট কার্ডের কোণে লাল সংখ্যা; শুধু খবর থাকলে */
  count?: string
}

/** প্রথম BIG_COUNT টি বড় (২ ঘর পাশাপাশি), বাকিগুলো ছোট */
const BIG_COUNT = 2

const SPAN_CLASS: Record<number, string> = { 2: "col-span-2", 3: "col-span-3", 6: "col-span-6" }

function ActionCard({ a, big, span }: { a: QuickAction; big: boolean; span: number }) {
  const Art = STICKER_ICONS[a.icon]
  return (
    <li className={SPAN_CLASS[span]}>
      <Link
        href={a.href}
        className={cn(
          "press card-surface relative isolate flex h-full flex-col justify-end overflow-hidden rounded-[20px] border border-line/70 bg-white",
          big ? "min-h-[136px] p-3.5" : "min-h-[104px] p-3",
        )}
      >
        <span aria-hidden="true" className="absolute right-0 -top-8 size-32 rounded-full" style={{ background: `radial-gradient(closest-side, ${GLOW[a.tone]}, transparent)` }} />
        <span aria-hidden="true" className={cn("pointer-events-none absolute", big ? "right-0 top-2 size-[72px]" : "right-0 top-1.5 size-[58px]")}>
          <Art />
        </span>
        {big && a.badge ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#fde8e4] px-2 py-1 text-[11px] font-extrabold leading-none text-[#b3342a]">
            <Icon name={a.badge.icon} size={12} />
            {a.badge.text}
          </span>
        ) : null}
        {!big && a.count ? (
          <span className="absolute left-3 top-3 min-w-5 rounded-full bg-alert px-1.5 text-center text-[11px] font-extrabold leading-5 text-white">{a.count}</span>
        ) : null}
        <span className={cn("relative font-extrabold leading-tight text-ink", big ? "text-[17px]" : "text-[14.5px]")}>{a.label}</span>
        {big && a.subtitle ? <span className="relative mt-0.5 text-xs font-medium leading-snug text-muted">{a.subtitle}</span> : null}
      </Link>
    </li>
  )
}

/** দ্রুত কাজ: প্রথম দুটি বড় কার্ড, বাকিগুলো ছোট; ছবি কার্ডের কোণে, নাম নিচে-বামে */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const big = actions.slice(0, BIG_COUNT)
  const small = actions.slice(BIG_COUNT)
  const spans = smallSpans(small.length)
  return (
    <section aria-label={tr("দ্রুত কাজ")}>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-ink">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-gold" />
        {tr("দ্রুত কাজ")}
      </h2>
      <ul className="grid grid-cols-6 gap-2.5">
        {big.map((a) => (
          <ActionCard key={a.key} a={a} big span={3} />
        ))}
        {small.map((a, i) => (
          <ActionCard key={a.key} a={a} big={false} span={spans[i] ?? 2} />
        ))}
      </ul>
    </section>
  )
}
