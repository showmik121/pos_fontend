"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import type { AdminAction } from "@/domain/admin-permissions"
import { useSession } from "@/lib/session"
import { btnCls } from "@/components/ui"

const NAV: ReadonlyArray<{ href: string; label: string; action?: AdminAction }> = [
  { href: "/dashboard/", label: "Dashboard" },
  { href: "/tenants/", label: "Shops" },
  { href: "/billing/", label: "Billing" },
  { href: "/health/", label: "Health" },
  { href: "/audit/", label: "Audit log" },
  { href: "/admins/", label: "Admins", action: "admins.list" },
]

/** Pages inside the shell need a signed-in operator; without one (reload, expiry) they go to the sign-in screen. */
export function Shell({ children }: { children: ReactNode }) {
  const { admin, signOut, allowed } = useSession()
  const router = useRouter()
  const path = usePathname()

  useEffect(() => {
    if (!admin) router.replace("/login/")
  }, [admin, router])

  if (!admin) return <p className="p-6 text-sm text-[var(--muted)]">Redirecting to sign in…</p>

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-[var(--surface)] focus:p-2">
        Skip to content
      </a>
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">Bipone Admin</span>
          <nav aria-label="Main" className="flex min-w-0 max-w-full flex-wrap gap-1">
            {NAV.filter((n) => n.action === undefined || allowed(n.action)).map((n) => {
              const current = path?.startsWith(n.href)
              return (
                <Link key={n.href} href={n.href} aria-current={current ? "page" : undefined} className={`whitespace-nowrap rounded px-3 py-1.5 text-sm ${current ? "bg-[var(--brand)] text-white dark:text-black" : "hover:bg-[var(--bg)]"}`}>
                  {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span>
              {admin.name} <span className="text-[var(--muted)]">({admin.role})</span>
            </span>
            <button type="button" className={btnCls} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
