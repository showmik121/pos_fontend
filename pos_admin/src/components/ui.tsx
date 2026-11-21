"use client"
import { useEffect, useRef, useId, type ReactNode } from "react"
import type { z } from "zod"
import type { StoreStatusSchema } from "@/contract/admin-api"

type Status = z.infer<typeof StoreStatusSchema>

const STATUS_STYLE: Record<Status, string> = {
  trial: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  grace: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  read_only: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  suspended: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  pending_deletion: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200",
  deleted: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200",
  cancelled: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200",
}

export const STATUS_LABEL: Record<Status, string> = {
  trial: "Trial",
  active: "Active",
  grace: "Grace period",
  read_only: "Read-only",
  suspended: "Suspended",
  pending_deletion: "Pending deletion",
  deleted: "Deleted",
  cancelled: "Cancelled",
}

/** colour is never the only signal: the label is always printed */
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
      {message}
    </p>
  )
}

interface FieldProps {
  label: string
  hint?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}
export function Field({ label, hint, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, hintId)}
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

// controls use --control (>= 3:1 against the surface, WCAG 1.4.11); --line is only for decorative dividers
export const inputCls = "w-full min-w-0 max-w-full rounded border border-[var(--control)] bg-[var(--surface)] px-3 py-2 text-sm"
export const btnCls = "rounded border border-[var(--control)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:border-[var(--brand)] disabled:opacity-50"
export const btnPrimaryCls = "rounded bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:text-black"
export const btnDangerCls = "rounded bg-[var(--danger)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:text-black"

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  /** true while a request is in flight: Escape is ignored so a half-finished action cannot be dismissed */
  busy?: boolean
  children: ReactNode
}
/** native <dialog>: focus is trapped, Escape closes, the page behind is inert, and focus returns to the opener (also when the dialog is unmounted) */
export function Dialog({ open, title, onClose, busy = false, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      d.showModal()
    }
    if (!open && d.open) d.close()
    return () => {
      if (d.open) d.close()
      opener.current?.focus()
      opener.current = null
    }
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onCancel={(e) => busy && e.preventDefault()} className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--text)]">
      {open ? (
        <div className="flex flex-col gap-4 p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
