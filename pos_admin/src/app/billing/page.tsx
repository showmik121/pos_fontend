"use client"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import type { Plan } from "@/contract/admin-api"
import { EditPlanDialog } from "@/components/billing-dialogs"
import { Shell } from "@/components/shell"
import { btnCls, ErrorNote, STATUS_LABEL, StatusBadge } from "@/components/ui"
import { call } from "@/lib/api"
import { formatDhaka } from "@/lib/format"
import { formatBdt } from "@/lib/money"
import { useSession } from "@/lib/session"
import { useLoad } from "@/lib/use-load"

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-xs text-[var(--muted)]">{note}</p> : null}
    </div>
  )
}

const shopLink = (id: string, name: string) => (
  <Link href={`/tenants/view/?id=${id}`} className="font-medium text-[var(--brand)] underline">
    {name}
  </Link>
)

export default function BillingPage() {
  const { allowed } = useSession()
  const overview = useLoad((signal) => call("billing.overview", { signal }), "overview")
  const plans = useLoad((signal) => call("billing.plans.list", { signal }), "plans")
  const [editing, setEditing] = useState<Plan | null>(null)
  const o = overview.data

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Billing</h1>
      <ErrorNote message={overview.error} />
      {overview.loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {o ? (
        <div className="flex flex-col gap-8">
          <section aria-labelledby="money-h">
            <h2 id="money-h" className="sr-only">
              Money
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Monthly recurring revenue" value={formatBdt(o.mrrPoisha)} note="Payments whose paid period covers today." />
              <Stat label="Collected this month" value={formatBdt(o.collectedThisMonthPoisha)} note={`${o.paymentsThisMonth} payment${o.paymentsThisMonth === 1 ? "" : "s"}, Asia/Dhaka month.`} />
              <Stat label="Voided this month" value={formatBdt(o.voidedThisMonthPoisha)} />
              <Stat label="Not billed yet" value={o.grandfathered} note="Existing shops until billing starts for them." />
            </div>
          </section>

          <section aria-labelledby="status-h">
            <h2 id="status-h" className="mb-3 text-lg font-semibold">
              Shops by status
            </h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {Object.entries(o.tenantsByStatus).map(([s, n]) => (
                <li key={s} className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">
                  {s in STATUS_LABEL ? <StatusBadge status={s as keyof typeof STATUS_LABEL} /> : s} <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="overdue-h">
            <h2 id="overdue-h" className="mb-3 text-lg font-semibold">
              Overdue ({o.overdueTotal})
            </h2>
            {o.overdue.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No shop is overdue.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {o.overdue.map((t) => (
                  <li key={t.id}>
                    {shopLink(t.id, t.name)} · <StatusBadge status={t.status} /> · due {formatDhaka(t.dueAt)} · {t.daysOverdue} day{t.daysOverdue === 1 ? "" : "s"} overdue
                  </li>
                ))}
              </ul>
            )}
            {o.overdueTotal > o.overdue.length ? <p className="mt-2 text-xs text-[var(--muted)]">Showing {o.overdue.length} of {o.overdueTotal}.</p> : null}
          </section>

          <section aria-labelledby="trials-h">
            <h2 id="trials-h" className="mb-3 text-lg font-semibold">
              Trials ending soon
            </h2>
            {o.trialsEndingSoon.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No trial ends in the next few days.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {o.trialsEndingSoon.map((t) => (
                  <li key={t.id}>
                    {shopLink(t.id, t.name)} · ends {formatDhaka(t.trialEndsAt)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <section aria-labelledby="plans-h" className="mt-8">
        <h2 id="plans-h" className="mb-3 text-lg font-semibold">
          Plans
        </h2>
        <ErrorNote message={plans.error} />
        {plans.data ? (
          <div className="relative overflow-x-auto rounded border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Plans and prices</caption>
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  {["Plan", "Price per 30 days", "Available", ""].map((h, i) => (
                    <th key={`${h}-${i}`} scope="col" className="px-3 py-2">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.data.plans.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2">{formatBdt(p.pricePoisha)}</td>
                    <td className="px-3 py-2">{p.active ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      {allowed("billing.plan.edit") ? (
                        <button type="button" className={btnCls} onClick={() => setEditing(p)} aria-label={`Edit plan ${p.name}`}>
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {editing ? (
        <EditPlanDialog
          open
          plan={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            plans.reload()
          }}
        />
      ) : null}
    </Shell>
  )
}
