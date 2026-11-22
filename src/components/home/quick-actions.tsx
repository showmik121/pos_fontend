import Link from "next/link"
import { tr } from "@/lib/i18n"
import { StickerTile, type StickerName } from "@/components/ui/sticker-icons"

export interface QuickAction {
  key: string
  href: string
  icon: StickerName
  label: string
  /** লাল ব্যাজ; শুধু খবর থাকলে দেওয়া হয় */
  badge?: string
}

/** দ্রুত কাজের গ্রিড: গোল ত্রিমাত্রিক টাইল, নিচে নাম */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section aria-label={tr("দ্রুত কাজ")}>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-ink">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-gold" />
        {tr("দ্রুত কাজ")}
      </h2>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4 pt-2">
        {actions.map((a) => (
          <li key={a.key}>
            <Link href={a.href} className="press flex flex-col items-center gap-2">
              <span className="block size-[76px]">
                <StickerTile name={a.icon} badge={a.badge} />
              </span>
              <span className="text-center text-[12.5px] font-semibold leading-tight text-ink2">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
