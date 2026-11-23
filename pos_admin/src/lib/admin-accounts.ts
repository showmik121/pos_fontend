// Pure helpers for the Admins screen. The server enforces every rule here again; these only shape what the operator sees.
import type { AdminSummary } from "@/contract/admin-api"

export const ROLE_LABEL: Record<AdminSummary["role"], string> = {
  super: "Super admin",
  support: "Support",
  finance: "Finance",
  viewer: "Viewer",
}

export const ROLE_HELP: Record<AdminSummary["role"], string> = {
  super: "Everything, including admin accounts and suspending shops.",
  support: "Look up shops, add notes, reveal phone numbers, triage errors.",
  finance: "Record and void payments, extend trials.",
  viewer: "Read-only access.",
}

export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128

/** same limits as the contract (12 to 128). Characters are counted as typed: no trimming, a space counts. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`
  return null
}

export interface AccountState {
  label: string
  tone: "ok" | "warn" | "off"
}

/** colour is never the only signal: the label is always printed */
export function accountState(a: AdminSummary): AccountState {
  if (!a.active) return { label: "Deactivated", tone: "off" }
  if (!a.enrolled) return a.mustReenroll ? { label: "Must set up 2FA again", tone: "warn" } : { label: "2FA not set up yet", tone: "warn" }
  return { label: "Active", tone: "ok" }
}

/** the server refuses role, active, 2FA and password changes on your own account; the buttons are simply not offered */
export function canActOn(selfId: string | null, target: AdminSummary): boolean {
  return selfId !== null && selfId !== target.id
}
