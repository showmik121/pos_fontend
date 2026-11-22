"use client"

import { tr } from "@/lib/i18n"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { useDb } from "@/components/db-provider"
import { NavIcon, type NavIconName } from "@/components/ui/nav-icons"
import { cn } from "@/lib/cn"
import { toBanglaDigits } from "@/lib/format/bn"
import { dueRows } from "@/lib/store/selectors"

/** ব্যাজে এর বেশি হলে "৯৯+" */
const BADGE_MAX = 99

type TabIcon = Exclude<NavIconName, "plus">
const LEFT_TABS: ReadonlyArray<{ href: string; label: string; icon: TabIcon }> = [
  { href: "/", label: "হোম", icon: "home" },
  { href: "/stock", label: "স্টক", icon: "box" },
]
const RIGHT_TABS: ReadonlyArray<{ href: string; label: string; icon: TabIcon; badge?: boolean }> = [
  { href: "/dues", label: "বাকি", icon: "ledger", badge: true },
  { href: "/reports", label: "রিপোর্ট", icon: "chart" },
]

function isActive(pathname: string, href: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/"
  return href === "/" ? clean === "/" : clean === href || clean.startsWith(`${href}/`)
}

function Tab({ href, label, icon, active, badge }: { href: string; label: string; icon: TabIcon; active: boolean; badge?: number }) {
  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined} className="press flex h-16 flex-col items-center justify-center gap-[3px]">
        <span className={cn("relative grid h-[30px] w-14 place-items-center rounded-full", active ? "bg-brand-soft text-brand-dark" : "text-muted")}>
          <NavIcon name={icon} active={active} />
          {badge ? (
            <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">
              {badge > BADGE_MAX ? `${toBanglaDigits(BADGE_MAX)}+` : toBanglaDigits(badge)}
            </span>
          ) : null}
        </span>
        <span className={cn("text-[11px] leading-none", active ? "font-bold text-brand-dark" : "font-medium text-muted")}>{tr(label)}</span>
      </Link>
    </li>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const { db } = useDb()
  const dueCount = useMemo(() => dueRows(db).length, [db])
  const billActive = isActive(pathname, "/sell")
  return (
    <nav aria-label={tr("প্রধান মেনু")} className="no-print sticky bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(42,35,21,0.06)]">
      <ul className="mx-auto grid max-w-(--app-col) grid-cols-5 px-1">
        {LEFT_TABS.map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />
        ))}
        <li>
          <Link href="/sell" aria-current={billActive ? "page" : undefined} className="press relative flex h-16 flex-col items-center justify-end pb-[11px]">
            <span aria-hidden="true" className="absolute -top-[22px] left-1/2 -translate-x-1/2">
              <span className="press grid size-[58px] place-items-center rounded-full border-4 border-white bg-gold text-ink shadow-[0_6px_16px_rgba(160,100,0,0.32)]">
                <NavIcon name="plus" size={28} strokeWidth={2.6} />
              </span>
            </span>
            <span className={cn("text-[11px] font-bold leading-none", billActive ? "text-brand-dark" : "text-ink")}>{tr("বিল")}</span>
          </Link>
        </li>
        {RIGHT_TABS.map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t.href)} badge={t.badge ? dueCount : undefined} />
        ))}
      </ul>
    </nav>
  )
}
