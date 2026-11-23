"use client"
import { useState } from "react"
import type { AdminSummary } from "@/contract/admin-api"
import { CreateAdminDialog, EditAdminDialog, ResetAdminDialog } from "@/components/admin-dialogs"
import { Shell } from "@/components/shell"
import { btnCls, btnPrimaryCls, ErrorNote } from "@/components/ui"
import { accountState, canActOn, ROLE_LABEL } from "@/lib/admin-accounts"
import { call } from "@/lib/api"
import { formatDhaka } from "@/lib/format"
import { useSession } from "@/lib/session"
import { useLoad } from "@/lib/use-load"

type Dialog = { kind: "create" } | { kind: "edit"; admin: AdminSummary } | { kind: "reset2fa" | "resetPassword"; admin: AdminSummary } | null

const TONE = {
  ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  off: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200",
} as const

export default function AdminsPage() {
  const { admin: me, allowed } = useSession()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const list = useLoad((signal) => call("admins.list", { signal }), "admins")
  const canManage = allowed("admins.create")

  const close = () => setDialog(null)
  const done = (message: string) => {
    setDialog(null)
    setNotice(message)
    list.reload()
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Admins</h1>
        {canManage ? (
          <button type="button" className={btnPrimaryCls} onClick={() => setDialog({ kind: "create" })}>
            Add an admin
          </button>
        ) : null}
      </div>
      {!allowed("admins.list") ? <p className="text-sm">Only a super admin can manage admin accounts.</p> : null}
      {notice ? (
        <p role="status" className="mb-4 rounded border border-[var(--control)] px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <ErrorNote message={list.error} />
      {list.loading && allowed("admins.list") ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {list.data ? (
        <div className="overflow-x-auto rounded border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Admin accounts</caption>
            <thead className="border-b border-[var(--line)]">
              <tr>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Role</th>
                <th scope="col" className="px-3 py-2">State</th>
                <th scope="col" className="px-3 py-2">Last sign-in</th>
                <th scope="col" className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.admins.map((a) => {
                const st = accountState(a)
                const actable = canActOn(me?.id ?? null, a)
                return (
                  <tr key={a.id} className="border-b border-[var(--line)] last:border-0">
                    <th scope="row" className="px-3 py-2 font-medium">
                      {a.name}
                      {!actable ? <span className="ml-1 text-xs font-normal text-[var(--muted)]">(you)</span> : null}
                      <span className="block text-xs font-normal text-[var(--muted)]">{a.email}</span>
                    </th>
                    <td className="px-3 py-2">{ROLE_LABEL[a.role]}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TONE[st.tone]}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2">{a.lastLoginAt ? formatDhaka(a.lastLoginAt) : "Never"}</td>
                    <td className="px-3 py-2">
                      {actable && canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={btnCls} onClick={() => setDialog({ kind: "edit", admin: a })}>
                            Change role
                          </button>
                          <button type="button" className={btnCls} onClick={() => setDialog({ kind: "reset2fa", admin: a })}>
                            Reset 2FA
                          </button>
                          <button type="button" className={btnCls} onClick={() => setDialog({ kind: "resetPassword", admin: a })}>
                            Reset password
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">{actable ? "—" : "Use the create-admin CLI for your own account"}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <CreateAdminDialog open={dialog?.kind === "create"} onClose={close} onDone={done} />
      {dialog?.kind === "edit" ? <EditAdminDialog open admin={dialog.admin} onClose={close} onDone={done} /> : null}
      {dialog?.kind === "reset2fa" ? <ResetAdminDialog open admin={dialog.admin} kind="2fa" onClose={close} onDone={done} /> : null}
      {dialog?.kind === "resetPassword" ? <ResetAdminDialog open admin={dialog.admin} kind="password" onClose={close} onDone={done} /> : null}
    </Shell>
  )
}
