"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { StoreStatusSchema, type Dashboard } from "@/contract/admin-api"
import { Shell } from "@/components/shell"
import { ErrorNote, STATUS_LABEL } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"
import { formatHours } from "@/lib/health"

const STATUS_ORDER = StoreStatusSchema.options

function Tile({ href, label, value, hint }: { href: string; label: string; value: number; hint?: string }) {
  return (
    <Link href={href} className="block rounded border border-[var(--line)] bg-[var(--surface)] p-4 hover:border-[var(--brand)]">
      <span className="block text-sm text-[var(--muted)]">{label}</span>
      <span className="block text-3xl font-semibold tabular-nums">{value.toLocaleString("en-US")}</span>
      {hint ? <span className="block text-xs text-[var(--muted)]">{hint}</span> : null}
    </Link>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctl = new AbortController()
    call("dashboard.get", { signal: ctl.signal })
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(friendlyError(e))
      })
    return () => ctl.abort()
  }, [])

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <ErrorNote message={error} />
      {!data && !error ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
      {data ? (
        <>
          <section aria-labelledby="needs-attention" className="mb-8">
            <h2 id="needs-attention" className="mb-3 text-base font-semibold">
              Needs attention
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile href="/health/?tab=sync" label="Stuck sync" value={data.stuckSync} hint={`No sync for ${formatHours(data.stuckHours)}+ (the list starts at 24 h; change it there)`} />
              <Tile href="/health/?tab=errors" label="New app errors" value={data.newErrors} hint="Open errors seen in the last 24 hours (the list shows every open error)" />
              <Tile href="/health/?tab=negative" label="Negative stock" value={data.negativeStockTenants} hint="Shops with stock below zero" />
              <Tile href="/tenants/" label="Signups today" value={data.signupsToday} hint="Since midnight, Dhaka time" />
            </div>
          </section>
          <section aria-labelledby="by-status">
            <h2 id="by-status" className="mb-3 text-base font-semibold">
              Shops by status
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STATUS_ORDER.map((s) => (
                <Tile key={s} href={`/tenants/?status=${s}`} label={STATUS_LABEL[s]} value={data.tenantsByStatus[s] ?? 0} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </Shell>
  )
}
