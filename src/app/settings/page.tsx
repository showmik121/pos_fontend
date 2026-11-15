"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { formatPhoneBn } from "@/lib/format/phone"

const KIND_LABEL = { pharmacy: "ফার্মেসি", cosmetics: "কসমেটিক্স", other: "অন্যান্য" } as const

export default function SettingsPage() {
  const { state, signOut } = useAuth()
  if (state.status !== "authed") return <AppShell title="সেটিংস" backHref="/">{null}</AppShell>
  const { user, store } = state

  return (
    <AppShell title="সেটিংস" backHref="/">
      <section className="divide-y divide-line rounded-2xl border border-line bg-white">
        <Row label="দোকান" value={store?.name ?? "—"} />
        <Row label="ধরন" value={store ? KIND_LABEL[store.kind] : "—"} />
        <Row label="আপনি" value={user.name} />
        <Row label="মোবাইল" value={formatPhoneBn(user.phone)} />
        <Row label="ভূমিকা" value={user.role === "owner" ? "মালিক" : "কর্মচারী"} />
      </section>

      {user.role === "owner" ? (
        <Link href="/settings/staff" className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-white px-4 active:bg-canvas">
          <span className="font-medium">কর্মচারী</span>
          <span aria-hidden="true" className="text-muted">
            ›
          </span>
        </Link>
      ) : null}

      <Button variant="danger" full onClick={signOut}>
        লগআউট
      </Button>
    </AppShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}
