"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { BottomNav } from "./bottom-nav"

interface AppShellProps {
  title: string
  /** দিলে হেডারে "পিছনে" লিংক দেখায় (সেটিংসের ভেতরের পর্দার জন্য) */
  backHref?: string
  /** হেডারের ডানের অংশ */
  action?: ReactNode
  children: ReactNode
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center text-muted" role="status">
      লোড হচ্ছে…
    </div>
  )
}

/** লগইন করা ইউজারের পর্দার কাঠামো: হেডার, মূল অংশ, নিচের মেনু। লগইন না থাকলে /login-এ পাঠায়। */
export function AppShell({ title, backHref, action, children }: AppShellProps) {
  const { state } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (state.status === "anon") router.replace("/login")
  }, [state.status, router])

  if (state.status !== "authed") return <Splash />

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-canvas pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-line bg-white px-4">
        {backHref ? (
          <Link href={backHref} aria-label="পিছনে যান" className="-ml-2 grid size-11 place-items-center rounded-lg text-ink active:bg-canvas">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
        ) : null}
        <h1 className="flex-1 truncate text-lg font-bold text-ink">{title}</h1>
        {action}
      </header>
      <main className="space-y-4 p-4">{children}</main>
      <BottomNav />
    </div>
  )
}
