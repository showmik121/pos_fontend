"use client"
import { useState, type FormEvent } from "react"
import type { z } from "zod"
import type { StatusChangeResultSchema } from "@/contract/admin-api"
import { btnCls, btnDangerCls, btnPrimaryCls, Dialog, ErrorNote, Field, inputCls } from "@/components/ui"
import { ApiError, call, friendlyError } from "@/lib/api"
import { useSession } from "@/lib/session"

export type StatusAction = "suspend" | "read_only" | "reactivate"
type Result = z.infer<typeof StatusChangeResultSchema>

const COPY: Record<StatusAction, { title: string; confirm: string; explain: string; danger: boolean }> = {
  suspend: {
    title: "Suspend this shop",
    confirm: "Suspend shop",
    explain: "The shop's phones stop syncing and the owner sees a notice. Data already on the phones is not touched.",
    danger: true,
  },
  read_only: {
    title: "Make this shop read-only",
    confirm: "Make read-only",
    explain: "The owner can still view and export data but cannot record new sales or stock. Syncing of past data continues.",
    danger: true,
  },
  reactivate: {
    title: "Reactivate this shop",
    confirm: "Reactivate shop",
    explain: "The shop returns to its trial if the trial has not ended, otherwise to active. The owner notice is cleared.",
    danger: false,
  },
}
const ROUTE = { suspend: "tenants.suspend", read_only: "tenants.readOnly", reactivate: "tenants.reactivate" } as const

interface Props {
  open: boolean
  action: StatusAction
  tenantId: string
  tenantName: string
  onClose: () => void
  onDone: (r: Result) => void
}

export function StatusDialog({ open, action, tenantId, tenantName, onClose, onDone }: Props) {
  const { stepUpValid, confirmStepUp } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const copy = COPY[action]
  const needsStepUp = !stepUpValid()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const reason = String(f.get("reason") ?? "").trim()
    const message = String(f.get("message") ?? "").trim()
    setBusy(true)
    setError(null)
    try {
      if (needsStepUp) await confirmStepUp(String(f.get("password") ?? ""), String(f.get("code") ?? "").trim())
      const input = action === "reactivate" ? { reason } : { reason, ...(message ? { message } : {}) }
      const result = await call(ROUTE[action], { id: tenantId, input })
      onDone(result)
    } catch (err) {
      // the step-up window may have lapsed between opening the dialog and submitting
      setError(err instanceof ApiError && err.code === "step_up_required" ? "Confirm your password and 2FA code, then submit again." : friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title={copy.title} onClose={onClose} busy={busy}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm">
          <strong>{tenantName}</strong>. {copy.explain}
        </p>
        <Field label="Reason (internal, saved in the audit log)" hint="At least 3 characters. The shop owner never sees this.">
          {(id, d) => <textarea id={id} aria-describedby={d} name="reason" required minLength={3} maxLength={1000} rows={3} className={inputCls} />}
        </Field>
        {action !== "reactivate" ? (
          <Field label="Message to the shop owner (optional)" hint="Shown in the shop app. Write it in Bangla. Leave empty to use the standard text.">
            {(id, d) => <textarea id={id} aria-describedby={d} name="message" maxLength={500} rows={2} lang="bn" className={inputCls} />}
          </Field>
        ) : null}
        {needsStepUp ? (
          <fieldset className="flex flex-col gap-3 rounded border border-[var(--line)] p-3">
            <legend className="px-1 text-sm font-medium">Confirm it is you</legend>
            <Field label="Your password">{(id) => <input id={id} name="password" type="password" autoComplete="current-password" required className={inputCls} />}</Field>
            <Field label="6-digit code (a fresh one)">{(id) => <input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" required className={inputCls} />}</Field>
          </fieldset>
        ) : null}
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnCls} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={copy.danger ? btnDangerCls : btnPrimaryCls} disabled={busy}>
            {busy ? "Working…" : copy.confirm}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
