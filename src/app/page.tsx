"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { Banner } from "@/components/ui/banner"

const KIND_LABEL = { pharmacy: "ফার্মেসি", cosmetics: "কসমেটিক্স", other: "দোকান" } as const

export default function HomePage() {
  const { state } = useAuth()
  const store = state.status === "authed" ? state.store : null
  const user = state.status === "authed" ? state.user : null

  return (
    <AppShell
      title={store?.name ?? "হোম"}
      action={
        <Link href="/settings" aria-label="সেটিংস" className="grid size-11 place-items-center rounded-lg text-ink active:bg-canvas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
          </svg>
        </Link>
      }
    >
      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="text-sm text-muted">{store ? KIND_LABEL[store.kind] : "দোকান"}</p>
        <p className="mt-0.5 text-lg font-bold">স্বাগতম{user ? `, ${user.name}` : ""}</p>
        <p className="mt-1 text-sm text-muted">আপনার দোকান তৈরি আছে। বিক্রি, স্টক আর বাকির পর্দা পরের ধাপগুলোতে যোগ হবে।</p>
      </section>

      <Banner tone="info">এটি প্রথম সংস্করণ: লগইন, দোকান ও কর্মচারীর ব্যবস্থাপনা কাজ করছে।</Banner>

      {user?.role === "owner" ? (
        <Link href="/settings/staff" className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-white px-4 active:bg-canvas">
          <span className="font-medium">কর্মচারী যোগ ও ব্যবস্থাপনা</span>
          <span aria-hidden="true" className="text-muted">
            ›
          </span>
        </Link>
      ) : null}
    </AppShell>
  )
}
