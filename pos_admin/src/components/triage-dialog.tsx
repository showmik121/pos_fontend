"use client"
import { useState, type FormEvent } from "react"
import { ErrorStatusSchema, type ClientErrorRow, type ErrorTriageResult } from "@/contract/admin-api"
import { btnCls, btnPrimaryCls, Dialog, ErrorNote, Field, inputCls } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"
import { ERROR_STATUS_LABEL } from "@/lib/health"

interface Props {
  error: ClientErrorRow | null
  onClose: () => void
  onDone: (r: ErrorTriageResult) => void
}

/** Triage is a plain write (no step-up): it only labels a crash report. The note is optional; leaving it empty clears the old one.
 * The form is its own component and is keyed by fingerprint, so a failure message never survives closing the dialog or opening another error. */
function TriageForm({ error, onClose, onDone }: { error: ClientErrorRow; onClose: () => void; onDone: (r: ErrorTriageResult) => void }) {
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const status = ErrorStatusSchema.safeParse(f.get("status"))
    if (!status.success) {
      setFailure("Pick a decision first.")
      return
    }
    const note = String(f.get("note") ?? "").trim()
    setBusy(true)
    setFailure(null)
    try {
      onDone(await call("health.errors.triage", { fingerprint: error.fingerprint, input: { status: status.data, ...(note ? { note } : {}) } }))
    } catch (err) {
      setFailure(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* crash text is attacker-writable (the report endpoint is public): plain text only, never HTML */}
      <p className="break-words text-sm">{error.message}</p>
      <Field label="Decision">
        {(id) => (
          <select id={id} name="status" defaultValue={error.status === "open" ? "resolved" : error.status} className={inputCls}>
            {(["resolved", "ignored", "open"] as const).map((s) => (
              <option key={s} value={s}>
                {ERROR_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Note (optional)" hint="Up to 500 characters. Shown to other operators. Do not paste personal data.">
        {(id, desc) => <textarea id={id} name="note" rows={3} maxLength={500} defaultValue={error.note ?? ""} aria-describedby={desc} className={inputCls} />}
      </Field>
      <ErrorNote message={failure} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={btnPrimaryCls} disabled={busy}>
          Save decision
        </button>
      </div>
    </form>
  )
}

export function TriageDialog({ error, onClose, onDone }: Props) {
  return (
    <Dialog open={error !== null} title="Triage this error" onClose={onClose}>
      {error ? <TriageForm key={error.fingerprint} error={error} onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  )
}
