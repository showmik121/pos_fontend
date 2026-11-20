"use client"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import type { TenantNote } from "@/contract/admin-api"
import { btnPrimaryCls, ErrorNote, Field, inputCls } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"
import { formatDhaka } from "@/lib/format"

/** Internal support notes. Append-only in A1 (no edit or delete). The shop owner never sees these. */
export function NotesPanel({ tenantId, canWrite }: { tenantId: string; canWrite: boolean }) {
  const [notes, setNotes] = useState<TenantNote[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const current = useRef(tenantId)
  current.current = tenantId

  const load = useCallback(async () => {
    try {
      const r = await call("tenants.notes.list", { id: tenantId })
      if (current.current === tenantId) setNotes(r.notes)
    } catch (e) {
      if (current.current === tenantId) setError(friendlyError(e))
    }
  }, [tenantId])

  useEffect(() => {
    setNotes(null)
    setError(null)
    void load()
  }, [load])

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const body = String(f.get("body") ?? "").trim()
    const tags = String(f.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    setBusy(true)
    setError(null)
    try {
      await call("tenants.notes.add", { id: tenantId, input: { body, tags } })
      form.reset()
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="notes-h" className="flex flex-col gap-3">
      <h2 id="notes-h" className="text-lg font-semibold">
        Internal notes
      </h2>
      <ErrorNote message={error} />
      {canWrite ? (
        <form onSubmit={add} className="flex flex-col gap-3">
          <Field label="New note">{(id) => <textarea id={id} name="body" required maxLength={2000} rows={3} className={inputCls} />}</Field>
          <Field label="Tags (optional)" hint="Comma-separated, lowercase letters and numbers, up to 10.">
            {(id, d) => <input id={id} aria-describedby={d} name="tags" className={inputCls} />}
          </Field>
          <div>
            <button type="submit" className={btnPrimaryCls} disabled={busy}>
              {busy ? "Saving…" : "Add note"}
            </button>
          </div>
        </form>
      ) : null}
      {notes === null ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {n.adminName ?? "Unknown"} · {formatDhaka(n.at)}
                {n.tags.length ? ` · ${n.tags.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
