"use client"
import { useRef, useState, type FormEvent } from "react"
import type { ResponseOf } from "@/contract/admin-api"
import { btnCls, btnPrimaryCls, Dialog, ErrorNote, Field, inputCls } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"

type Phones = ResponseOf<"tenants.revealPhone">["phones"]

/** Full phone numbers are PII: revealing them needs a reason, is written to the audit log, and the numbers are dropped when this closes. */
export function RevealDialog({ open, tenantId, onClose }: { open: boolean; tenantId: string; onClose: () => void }) {
  const [phones, setPhones] = useState<Phones | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // bumped on every close: a reply that arrives after the dialog was closed must not put numbers back on screen
  const generation = useRef(0)

  function close() {
    generation.current += 1
    setPhones(null)
    setError(null)
    setBusy(false)
    onClose()
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim()
    const mine = generation.current
    setBusy(true)
    setError(null)
    try {
      const r = await call("tenants.revealPhone", { id: tenantId, input: { reason } })
      if (mine === generation.current) setPhones(r.phones)
    } catch (err) {
      if (mine === generation.current) setError(friendlyError(err))
    } finally {
      if (mine === generation.current) setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Show full phone numbers" onClose={close} busy={busy}>
      {phones ? (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1 text-sm" aria-label="Phone numbers">
            {phones.map((p) => (
              <li key={`${p.role}-${p.phone}`}>
                {p.name} <span className="text-[var(--muted)]">({p.role})</span>: <span className="font-mono">{p.phone}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">This view was recorded in the audit log. Numbers are hidden again when you close this.</p>
          <div className="flex justify-end">
            <button type="button" className={btnCls} onClick={close}>
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Reason" hint="Required. Saved in the audit log with your name.">
            {(id, d) => <textarea id={id} aria-describedby={d} name="reason" required minLength={3} maxLength={1000} rows={3} className={inputCls} />}
          </Field>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnCls} onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={btnPrimaryCls} disabled={busy}>
              {busy ? "Working…" : "Show numbers"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
