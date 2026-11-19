"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/cn"

const TABS = [
  { href: "/", label: "হোম", icon: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" },
  { href: "/sell", label: "বিল", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { href: "/stock", label: "স্টক", icon: "M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12l8.5-4M12 12v8" },
  { href: "/dues", label: "বাকি", icon: "M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4" },
  { href: "/reports", label: "রিপোর্ট", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
] as const

function isActive(pathname: string, href: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/"
  return href === "/" ? clean === "/" : clean === href || clean.startsWith(`${href}/`)
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="প্রধান মেনু" className="no-print sticky bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-(--app-col) grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs", active ? "font-medium text-brand" : "text-muted")}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
                {active ? <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gold" /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
