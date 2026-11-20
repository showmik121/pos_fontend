"use client"

import { tr } from "@/lib/i18n"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { BottomNav } from "./bottom-nav"
import { useDb } from "./db-provider"
import { BackupReminder } from "./backup-reminder"
import { InstallBanner } from "./install-banner"
import { Icon } from "./ui/icons"

interface AppShellProps {
  title: string
  /** দিলে হেডারে "পিছনে" লিংক দেখায় */
  backHref?: string
  /** হেডারের ডানের অংশ */
  action?: ReactNode
  /** নিচের প্রধান মেনু দেখাবে কি না (ডিফল্ট: না; শুধু ৫টি মূল পর্দায় true) */
  nav?: boolean
  /** নিচে আটকানো অ্যাকশন বার (মেনুর বদলে) */
  footer?: ReactNode
  /** পাতার শেষে শহর-দৃশ্যের জলছাপ (ডিফল্ট: মেনুওয়ালা পাতায় আছে) */
  art?: boolean
  /** দিলে সাধারণ হেডারের বদলে এটি দেখায় (হোমের ছবিওয়ালা হেডার) */
  hero?: ReactNode
  children: ReactNode
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center text-muted" role="status">
      {tr("লোড হচ্ছে…")}
    </div>
  )
}

/** লগইন ও লোকাল ডেটা তৈরি না হওয়া পর্যন্ত ভেতরের অংশ (যার state ডেটা থেকে শুরু হয়) চালায় না */
export function Ready({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const { ready } = useDb()
  const router = useRouter()
  useEffect(() => {
    if (state.status === "anon") router.replace("/login")
  }, [state.status, router])
  if (state.status !== "authed" || !ready) return <Splash />
  return <>{children}</>
}

/** লগইন করা ইউজারের পর্দার কাঠামো: হেডার, মূল অংশ, নিচের মেনু বা অ্যাকশন বার। লগইন না থাকলে /login-এ পাঠায়। */
export function AppShell({ title, backHref, action, nav = false, footer, art = nav, hero, children }: AppShellProps) {
  const { state } = useAuth()
  const { ready, saveFailed } = useDb()
  const router = useRouter()

  useEffect(() => {
    if (state.status === "anon") router.replace("/login")
  }, [state.status, router])

  if (state.status !== "authed" || !ready) return <Splash />

  return (
    <div className="mx-auto flex min-h-dvh max-w-(--app-col) flex-col bg-canvas">
      {hero ?? (
        <header className="no-print sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-line bg-white px-4">
          {backHref ? (
            <Link href={backHref} aria-label={tr("পিছনে যান")} className="-ml-2 grid size-11 place-items-center rounded-lg text-ink active:bg-canvas">
              <Icon name="back" size={22} />
            </Link>
          ) : null}
          <h1 className="flex-1 truncate text-lg font-bold text-ink">{title}</h1>
          {action}
        </header>
      )}
      {saveFailed ? (
        <div role="alert" className="bg-danger-bg px-4 py-2 text-sm text-danger">
          {tr("ফোনের জায়গা ভরা বা সেভ বন্ধ — নতুন তথ্য সেভ হচ্ছে না। জায়গা খালি করুন।")}
        </div>
      ) : null}
      <main className="flex-1 space-y-4 p-4">
        {nav ? <BackupReminder /> : null}
        {nav ? <InstallBanner /> : null}
        {children}
      </main>
      {art ? <div aria-hidden="true" className="app-skyline no-print" /> : null}
      {footer ? (
        <div className="no-print sticky bottom-0 z-10 border-t border-line bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">{footer}</div>
      ) : nav ? (
        <BottomNav />
      ) : null}
    </div>
  )
}
