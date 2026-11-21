"use client"
import { useState, type FormEvent } from "react"
import type { Payment, Plan, RecordPaymentResult } from "@/contract/admin-api"
import { StepUpFieldset } from "@/components/step-up-fieldset"
import { btnCls, btnDangerCls, btnPrimaryCls, Dialog, ErrorNote, Field, inputCls } from "@/components/ui"
import { ApiError, call, friendlyError } from "@/lib/api"
import { dhakaLocalToIso, formatBdt, newIdempotencyKey, parseTakaToPoisha, poishaToTakaInput } from "@/lib/money"
import { useSession } from "@/lib/session"

const METHODS = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
] as const
type Method = (typeof METHODS)[number]["value"]

function Actions({ onClose, busy, label, danger = false }: { onClose: () => void; busy: boolean; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" className={btnCls} onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button type="submit" className={danger ? btnDangerCls : btnPrimaryCls} disabled={busy}>
        {busy ? "Working…" : label}
      </button>
    </div>
  )
}

/** After a definite refusal (4xx) the request is wrong, so the next try needs a new key; after a network/5xx failure the outcome is unknown, so the SAME key is reused (a safe retry). */
const outcomeUnknown = (e: unknown) => !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.code === "bad_response" // a 2xx with an unreadable body may well have recorded the payment

const MAX_PAYMENT_POISHA = 100_000_000

// ------------------------------------------------------------------ record payment
interface RecordProps {
  open: boolean
  tenantId: string
  tenantName: string
  plans: Plan[]
  defaultPlanId: string | null
  onClose: () => void
  onDone: (r: RecordPaymentResult) => void
}

export function RecordPaymentDialog({ open, tenantId, tenantName, plans, defaultPlanId, onClose, onDone }: RecordProps) {
  const active = plans.filter((p) => p.active)
  const initial = active.find((p) => p.id === defaultPlanId) ?? active[0]
  const [planId, setPlanId] = useState(initial?.id ?? "")
  const [amount, setAmount] = useState(initial ? poishaToTakaInput(initial.pricePoisha) : "")
  const [method, setMethod] = useState<Method>("bkash")
  const [key, setKey] = useState(newIdempotencyKey)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const plan = plans.find((p) => p.id === planId)

  function pickPlan(id: string) {
    setPlanId(id)
    const p = plans.find((x) => x.id === id)
    if (p) setAmount(poishaToTakaInput(p.pricePoisha))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const amountPoisha = parseTakaToPoisha(amount)
    if (amountPoisha === null || amountPoisha <= 0) return setError("Enter the amount in taka, for example 1199 or 1199.50.")
    if (amountPoisha > MAX_PAYMENT_POISHA) return setError("That amount is too large for one payment (the limit is ৳1,000,000).")
    const txnRef = String(f.get("txnRef") ?? "").trim()
    if (method !== "cash" && !txnRef) return setError("Enter the transaction ID (only cash payments can leave it empty).")
    const paidRaw = String(f.get("paidAt") ?? "")
    const paidAt = paidRaw ? dhakaLocalToIso(paidRaw) : null
    if (paidRaw && !paidAt) return setError("The payment time is not valid.")
    setBusy(true)
    setError(null)
    try {
      const input = { idempotencyKey: key, amountPoisha, method, ...(method !== "cash" && txnRef ? { txnRef } : {}), ...(paidAt ? { paidAt } : {}), ...(planId ? { planId } : {}) }
      const result = await call("billing.payments.record", { id: tenantId, input })
      onDone(result)
    } catch (err) {
      if (outcomeUnknown(err)) setError(`${friendlyError(err)} The payment may already be recorded: check the payments list before trying again.`)
      else {
        setKey(newIdempotencyKey())
        setError(friendlyError(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Record a payment" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">
          <strong>{tenantName}</strong>. One payment buys one 30-day period. It is added after the paid-until date if that is still ahead, otherwise it starts at the payment time. A suspended, read-only or pending-deletion shop keeps its status: reactivate it separately after recording the payment.
        </p>
        <Field label="Plan">
          {(id) => (
            <select id={id} className={inputCls} value={planId} onChange={(e) => pickPlan(e.target.value)} required>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatBdt(p.pricePoisha)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Amount received (taka)" hint={plan ? `Plan price ${formatBdt(plan.pricePoisha)}. Less than the price is refused.` : undefined}>
          {(id, d) => <input id={id} aria-describedby={d} inputMode="decimal" required className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Method">
          {(id) => (
            <select id={id} className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        {method !== "cash" ? (
          <Field label="Transaction ID" hint="The bKash / Nagad / Rocket transaction ID or the bank reference. The same ID cannot be recorded twice.">
            {(id, d) => <input id={id} aria-describedby={d} name="txnRef" maxLength={60} autoComplete="off" className={inputCls} />}
          </Field>
        ) : null}
        <Field label="Paid at (Asia/Dhaka, optional)" hint="Leave empty for now. It cannot be in the future.">
          {(id, d) => <input id={id} aria-describedby={d} name="paidAt" type="datetime-local" className={inputCls} />}
        </Field>
        <ErrorNote message={error} />
        <Actions onClose={onClose} busy={busy} label="Record payment" />
      </form>
    </Dialog>
  )
}

// ------------------------------------------------------------------ void payment (step-up)
interface VoidProps {
  open: boolean
  payment: Payment
  onClose: () => void
  onDone: () => void
}

export function VoidPaymentDialog({ open, payment, onClose, onDone }: VoidProps) {
  const { stepUpValid, confirmStepUp } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needsStepUp = !stepUpValid()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const reason = String(f.get("reason") ?? "").trim()
    setBusy(true)
    setError(null)
    try {
      if (needsStepUp) await confirmStepUp(String(f.get("password") ?? ""), String(f.get("code") ?? "").trim())
      await call("billing.payments.void", { id: payment.id, input: { reason } })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError && err.code === "step_up_required" ? "Confirm your password and 2FA code, then submit again." : friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Void this payment" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">
          Void the <strong>{formatBdt(payment.amountPoisha)}</strong> payment ({payment.method}
          {payment.txnRef ? `, ${payment.txnRef}` : ""}). The row stays in the history, marked voided, and the paid-until date is worked out again from the remaining payments. The shop&apos;s status is not changed automatically.
        </p>
        <Field label="Reason (internal, saved in the audit log)" hint="At least 3 characters.">
          {(id, d) => <textarea id={id} aria-describedby={d} name="reason" required minLength={3} maxLength={1000} rows={3} className={inputCls} />}
        </Field>
        {needsStepUp ? <StepUpFieldset /> : null}
        <ErrorNote message={error} />
        <Actions onClose={onClose} busy={busy} label="Void payment" danger />
      </form>
    </Dialog>
  )
}

// ------------------------------------------------------------------ extend trial
interface ExtendProps {
  open: boolean
  tenantId: string
  tenantName: string
  onClose: () => void
  onDone: (trialEndsAt: string) => void
}

export function ExtendTrialDialog({ open, tenantId, tenantName, onClose, onDone }: ExtendProps) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const days = Number(f.get("days"))
    if (!Number.isInteger(days) || days < 1 || days > 30) return setError("Enter a whole number of days from 1 to 30.")
    setBusy(true)
    setError(null)
    try {
      const r = await call("billing.trial.extend", { id: tenantId, input: { days, reason: String(f.get("reason") ?? "").trim() } })
      onDone(r.trialEndsAt)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Extend the trial" onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">
          <strong>{tenantName}</strong>. Adds days to the trial end date. A trial can run at most 60 days from today.
        </p>
        <Field label="Days to add (1–30)">{(id) => <input id={id} name="days" type="number" min={1} max={30} step={1} required className={inputCls} />}</Field>
        <Field label="Reason (internal, saved in the audit log)" hint="At least 3 characters.">
          {(id, d) => <textarea id={id} aria-describedby={d} name="reason" required minLength={3} maxLength={1000} rows={3} className={inputCls} />}
        </Field>
        <ErrorNote message={error} />
        <Actions onClose={onClose} busy={busy} label="Extend trial" />
      </form>
    </Dialog>
  )
}

// ------------------------------------------------------------------ edit plan (step-up)
interface PlanProps {
  open: boolean
  plan: Plan
  onClose: () => void
  onDone: () => void
}

export function EditPlanDialog({ open, plan, onClose, onDone }: PlanProps) {
  const { stepUpValid, confirmStepUp } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needsStepUp = !stepUpValid()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const pricePoisha = parseTakaToPoisha(String(f.get("price") ?? ""))
    if (pricePoisha === null) return setError("Enter the price in taka, for example 1199 or 1199.50.")
    const name = String(f.get("name") ?? "").trim()
    const activeNext = f.get("active") === "on"
    setBusy(true)
    setError(null)
    try {
      if (needsStepUp) await confirmStepUp(String(f.get("password") ?? ""), String(f.get("code") ?? "").trim())
      await call("billing.plans.update", { id: plan.id, input: { name, pricePoisha, active: activeNext, reason: String(f.get("reason") ?? "").trim() } })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError && err.code === "step_up_required" ? "Confirm your password and 2FA code, then submit again." : friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title={`Edit plan: ${plan.name}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">A price change applies to new billing periods only. Payments already recorded are never changed.</p>
        <Field label="Name">{(id) => <input id={id} name="name" required maxLength={60} defaultValue={plan.name} className={inputCls} />}</Field>
        <Field label="Price per 30 days (taka)">{(id) => <input id={id} name="price" inputMode="decimal" required defaultValue={poishaToTakaInput(plan.pricePoisha)} className={inputCls} />}</Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={plan.active} /> Available for new payments
        </label>
        <Field label="Reason (internal, saved in the audit log)" hint="At least 3 characters.">
          {(id, d) => <textarea id={id} aria-describedby={d} name="reason" required minLength={3} maxLength={1000} rows={3} className={inputCls} />}
        </Field>
        {needsStepUp ? <StepUpFieldset /> : null}
        <ErrorNote message={error} />
        <Actions onClose={onClose} busy={busy} label="Save plan" />
      </form>
    </Dialog>
  )
}
