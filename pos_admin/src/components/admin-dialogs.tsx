"use client"
// Create / change / reset dialogs for admin accounts. All of them are step-up actions (password + fresh 2FA code, valid 5 min).
import { useState, type FormEvent } from "react"
import type { AdminSummary } from "@/contract/admin-api"
import { StepUpFieldset } from "@/components/step-up-fieldset"
import { btnCls, btnDangerCls, btnPrimaryCls, Dialog, ErrorNote, Field, inputCls } from "@/components/ui"
import { ApiError, call, friendlyError } from "@/lib/api"
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem, ROLE_HELP, ROLE_LABEL } from "@/lib/admin-accounts"
import { useSession } from "@/lib/session"

const ROLES = ["super", "support", "finance", "viewer"] as const

/** Runs `act` after (if needed) confirming step-up. One place for busy / error handling so the three dialogs cannot drift. */
function useGuardedSubmit(act: (f: FormData) => Promise<void>) {
  const { stepUpValid, confirmStepUp } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needsStepUp = !stepUpValid()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      if (needsStepUp) await confirmStepUp(String(f.get("password") ?? ""), String(f.get("code") ?? "").trim())
      await act(f)
    } catch (err) {
      // the 5-minute window may have lapsed between opening the dialog and submitting
      setError(err instanceof ApiError && err.code === "step_up_required" ? "Confirm your password and 2FA code, then submit again." : friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  return { error, busy, needsStepUp, submit, clearError: () => setError(null) }
}

const reasonOf = (f: FormData): { reason?: string } => {
  const r = String(f.get("reason") ?? "").trim()
  return r ? { reason: r } : {}
}

const ReasonField = () => (
  <Field label="Reason (optional, saved in the audit log)">{(id) => <input id={id} name="reason" maxLength={1000} className={inputCls} />}</Field>
)

function Actions({ busy, onClose, label, danger = false }: { busy: boolean; onClose: () => void; label: string; danger?: boolean }) {
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

interface Common {
  open: boolean
  onClose: () => void
  onDone: (message: string) => void
}

export function CreateAdminDialog({ open, onClose, onDone }: Common) {
  const g = useGuardedSubmit(async (f) => {
    const password = String(f.get("newPassword") ?? "")
    const problem = passwordProblem(password)
    if (problem) throw new ApiError(400, "invalid_input", problem)
    await call("admins.create", {
      input: { email: String(f.get("email") ?? ""), name: String(f.get("name") ?? "").trim(), role: String(f.get("role")) as AdminSummary["role"], password, ...reasonOf(f) },
    })
    onDone("Admin created. Give them the password through a private channel; they set up 2FA at first sign-in.")
  })
  return (
    <Dialog open={open} title="Add an admin" onClose={onClose} busy={g.busy}>
      <form onSubmit={g.submit} className="flex flex-col gap-4">
        <Field label="Name">{(id) => <input id={id} name="name" required maxLength={120} autoComplete="off" className={inputCls} />}</Field>
        <Field label="Email">{(id) => <input id={id} name="email" type="email" required maxLength={254} autoComplete="off" className={inputCls} />}</Field>
        <Field label="Role" hint="Can be changed later.">
          {(id, d) => (
            <select id={id} aria-describedby={d} name="role" defaultValue="support" className={inputCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} — {ROLE_HELP[r]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Temporary password" hint={`${PASSWORD_MIN} to ${PASSWORD_MAX} characters. Shown nowhere after this; the admin should change it.`}>
          {(id, d) => <input id={id} aria-describedby={d} name="newPassword" type="password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" className={inputCls} />}
        </Field>
        <ReasonField />
        {g.needsStepUp ? <StepUpFieldset /> : null}
        <ErrorNote message={g.error} />
        <Actions busy={g.busy} onClose={onClose} label="Create admin" />
      </form>
    </Dialog>
  )
}

export function EditAdminDialog({ open, admin, onClose, onDone }: Common & { admin: AdminSummary }) {
  const g = useGuardedSubmit(async (f) => {
    const role = String(f.get("role")) as AdminSummary["role"]
    const active = f.get("active") === "on"
    if (role === admin.role && active === admin.active) throw new ApiError(400, "invalid_input", "")
    await call("admins.update", { id: admin.id, input: { role, active, ...reasonOf(f) } })
    onDone(`${admin.name} updated.`)
  })
  return (
    <Dialog open={open} title={`Change ${admin.name}`} onClose={onClose} busy={g.busy}>
      <form onSubmit={g.submit} className="flex flex-col gap-4">
        <Field label="Role">
          {(id) => (
            <select id={id} name="role" defaultValue={admin.role} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} — {ROLE_HELP[r]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={admin.active} />
          Account is active (turning this off signs them out at once)
        </label>
        <ReasonField />
        {g.needsStepUp ? <StepUpFieldset /> : null}
        <ErrorNote message={g.error} />
        <Actions busy={g.busy} onClose={onClose} label="Save changes" />
      </form>
    </Dialog>
  )
}

export function ResetAdminDialog({ open, admin, kind, onClose, onDone }: Common & { admin: AdminSummary; kind: "2fa" | "password" }) {
  const g = useGuardedSubmit(async (f) => {
    if (kind === "2fa") {
      await call("admins.reset2fa", { id: admin.id, input: reasonOf(f) })
      onDone(`2FA reset for ${admin.name}. They set it up again at next sign-in.`)
      return
    }
    const password = String(f.get("newPassword") ?? "")
    const problem = passwordProblem(password)
    if (problem) throw new ApiError(400, "invalid_input", problem)
    await call("admins.resetPassword", { id: admin.id, input: { password, ...reasonOf(f) } })
    onDone(`Password reset for ${admin.name}. All their sessions ended and 2FA must be set up again.`)
  })
  return (
    <Dialog open={open} title={kind === "2fa" ? `Reset 2FA for ${admin.name}` : `Reset password for ${admin.name}`} onClose={onClose} busy={g.busy}>
      <form onSubmit={g.submit} className="flex flex-col gap-4">
        <p className="text-sm">
          {kind === "2fa"
            ? "Their authenticator and recovery codes stop working. At next sign-in they set up 2FA again."
            : "Their sessions end, the old password stops working, and 2FA is cleared so they set it up again."}
        </p>
        {kind === "password" ? (
          <Field label="New temporary password" hint={`${PASSWORD_MIN} to ${PASSWORD_MAX} characters. Send it through a private channel.`}>
            {(id, d) => <input id={id} aria-describedby={d} name="newPassword" type="password" required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" className={inputCls} />}
          </Field>
        ) : null}
        <ReasonField />
        {g.needsStepUp ? <StepUpFieldset /> : null}
        <ErrorNote message={g.error} />
        <Actions busy={g.busy} onClose={onClose} label={kind === "2fa" ? "Reset 2FA" : "Reset password"} danger />
      </form>
    </Dialog>
  )
}
