import Link from "next/link"
import { cn } from "@/lib/cn"
import { tr } from "@/lib/i18n"

export type AlertTone = "coral" | "gold" | "teal" | "plum" | "sand"

const TONE: Record<AlertTone, string> = {
  coral: "bg-[#fde4da] text-[#8a3416]",
  gold: "bg-[#ffefb8] text-[#6b4700]",
  teal: "bg-[#d9efee] text-[#0f4f52]",
  plum: "bg-[#f2e1ee] text-[#5d2a52]",
  sand: "bg-chip text-ink",
}

export interface AlertCard {
  key: string
  href: string
  tone: AlertTone
  label: string
  big: string
  sub: string
}

/** "নজর দিন": পাশে টানা যায় এমন রঙিন কার্ড; একটি বড় সংখ্যা ও এক লাইনের ব্যাখ্যা */
export function AlertCards({ cards }: { cards: AlertCard[] }) {
  return (
    <ul className="snap-row -mx-4 px-4 pb-1" aria-label={tr("নজর দিন")}>
      {cards.map((c) => (
        <li key={c.key} className="flex-none">
          <Link href={c.href} className={cn("press flex h-full w-40 flex-col gap-0.5 rounded-[20px] px-3.5 pb-3.5 pt-3", TONE[c.tone])}>
            <span className="text-[12.5px] font-bold leading-tight">{c.label}</span>
            <span className="mt-1.5 truncate text-[22px] font-extrabold leading-tight">{c.big}</span>
            <span className="text-xs font-medium leading-snug opacity-85">{c.sub}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
