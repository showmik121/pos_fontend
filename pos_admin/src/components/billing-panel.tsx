"use client"
import { useState } from "react"
import type { Payment } from "@/contract/admin-api"
import { ExtendTrialDialog, RecordPaymentDialog, VoidPaymentDialog } from "@/components/billing-dialogs"
import { btnCls, btnPrimaryCls, ErrorNote, StatusBadge } from "@/components/ui"
import { call } from "@/lib/api"
import { formatDhaka } from "@/lib/format"
import { formatBdt } from "@/lib/money"
import { useSession } from "@/lib/session"
import { useLoad } from "@/lib/use-load"

const METHOD_LABEL: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", bank: "Bank", cash: "Cash" }

/** Billing section of the shop page: plan, paid-until, payment history (voided rows stay visible) and the status events. Buttons only for roles that may use them; the server decides. */
export function BillingPanel({ tenantId, tenantName, onChanged }: { tenantId: string; tenantName: string; onChanged: () => void }) {
  const { allowed } = useSession()
  const billing = useLoad(async (signal) => {
    const [b, p] = await Promise.all([call("billing.tenant", { id: tenantId, signal }), call("billing.plans.list", { signal })])
    return { b, plans: p.plans }
  }, tenantId)
  const [dialog, setDialog] = useState<"record" | "extend" | null>(null)
  const [voiding, setVoiding] = useState<Payment | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const data = billing.data
  const b = data?.b

  function done(message: string) {
    setDialog(null)
    setVoiding(null)
    setFlash(message)
    billing.reload()
    onChanged() // the shop's status may have changed
  }

  return (
    <section aria-labelledby="billing-h" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 id="billing-h" className="text-lg font-semibold">
          Billing
        </h2>
        <div className="ml-auto flex gap-2">
          {b && b.status === "trial" && allowed("billing.trial.extend") ? (
            <button type="button" className={btnCls} onClick={() => setDialog("extend")}>
              Extend trial
            </button>
          ) : null}
          {data && allowed("billing.payment.record") ? (
            <button type="button" className={btnPrimaryCls} onClick={() => setDialog("record")}>
              Record payment
            </button>
          ) : null}
        </div>
      </div>
      <ErrorNote message={billing.error} />
      {flash ? (
        <p role="status" className="mb-3 rounded border border-[var(--ok)] px-3 py-2 text-sm text-[var(--ok)]">
          {flash}
        </p>
      ) : null}
      {billing.loading ? <p className="text-sm text-[var(--muted)]">Loading billing…</p> : null}

      {b && data ? (
        <div className="flex min-w-0 flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Status</dt>
              <dd>
                <StatusBadge status={b.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Plan</dt>
              <dd>{b.plan ? `${b.plan.name} (${formatBdt(b.plan.pricePoisha)} per 30 days)` : "No plan yet"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Billing</dt>
              <dd>{b.grandfathered ? "Not billed yet (existing shop)" : "Billed"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Trial ends</dt>
              <dd>{formatDhaka(b.trialEndsAt)}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Paid until</dt>
              <dd>{formatDhaka(b.currentPeriodEnd)}</dd>
            </div>
          </dl>

          <div className="relative overflow-x-auto rounded border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Payments for {tenantName}</caption>
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  {["Paid at", "Amount", "Method", "Transaction ID", "Period", "Recorded by", ""].map((h, i) => (
                    <th key={`${h}-${i}`} scope="col" className="px-3 py-2">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.payments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="px-3 py-2">{formatDhaka(p.paidAt)}</td>
                    <td className={`px-3 py-2 ${p.voidedAt ? "line-through" : ""}`}>{formatBdt(p.amountPoisha)}</td>
                    <td className="px-3 py-2">{METHOD_LABEL[p.method] ?? p.method}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.txnRef ?? "—"}</td>
                    <td className="px-3 py-2">
                      {formatDhaka(p.periodStart)} → {formatDhaka(p.periodEnd)}
                    </td>
                    <td className="px-3 py-2">{p.recordedByName ?? "—"}</td>
                    <td className="px-3 py-2">
                      {p.voidedAt ? (
                        <span>
                          <strong>Voided</strong> {formatDhaka(p.voidedAt)}
                          {p.voidReason ? <span className="block text-[var(--muted)]">Reason: {p.voidReason}</span> : null}
                        </span>
                      ) : allowed("billing.payment.void") ? (
                        <button type="button" className={btnCls} onClick={() => setVoiding(p)} aria-label={`Void the ${formatBdt(p.amountPoisha)} payment of ${formatDhaka(p.paidAt)}`}>
                          Void
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {b.payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-[var(--muted)]">
                      No payments recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {b.events.length > 0 ? (
            <ol className="flex flex-col gap-2 text-sm">
              {b.events.map((ev) => (
                <li key={`${ev.at}-${ev.toStatus}`} className="rounded border border-[var(--line)] bg-[var(--surface)] p-3">
                  <p>
                    {ev.fromStatus ?? "—"} → <strong>{ev.toStatus}</strong> · {formatDhaka(ev.at)} · {ev.adminName ?? ev.actor}
                  </p>
                  <p className="text-[var(--muted)]">{ev.reason}</p>
                </li>
              ))}
            </ol>
          ) : null}

          {dialog === "record" ? (
          <RecordPaymentDialog
            open
            tenantId={tenantId}
            tenantName={tenantName}
            plans={data.plans}
            defaultPlanId={b.plan?.id ?? null}
            onClose={() => {
              // a fresh form (and a fresh idempotency key) next time; reload now so an attempt whose outcome was unknown shows up in the list
              setDialog(null)
              billing.reload()
            }}
            onDone={(r) => done(r.replayed ? (r.payment.voidedAt ? "That payment was recorded earlier and has since been voided; nothing new was applied." : "That payment was already recorded; nothing new was applied.") : `Payment recorded. Status ${r.fromStatus === r.toStatus ? "stays" : `changed from ${r.fromStatus} to`} ${r.toStatus}.`)}
          />
          ) : null}
          <ExtendTrialDialog open={dialog === "extend"} tenantId={tenantId} tenantName={tenantName} onClose={() => setDialog(null)} onDone={(end) => done(`Trial now ends ${formatDhaka(end)}.`)} />
          {voiding ? <VoidPaymentDialog open payment={voiding} onClose={() => setVoiding(null)} onDone={() => done("Payment voided.")} /> : null}
        </div>
      ) : null}
    </section>
  )
}
