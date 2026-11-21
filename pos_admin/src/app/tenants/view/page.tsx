"use client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { ResponseOf } from "@/contract/admin-api"
import { BillingPanel } from "@/components/billing-panel"
import { NotesPanel } from "@/components/notes-panel"
import { RevealDialog } from "@/components/reveal-dialog"
import { Shell } from "@/components/shell"
import { StatusDialog, type StatusAction } from "@/components/status-dialog"
import { btnCls, ErrorNote, StatusBadge } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"
import { formatDhaka, formatRelative } from "@/lib/format"
import { useSession } from "@/lib/session"

type Detail = ResponseOf<"tenants.get">
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-sm text-[var(--muted)]">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function TenantView() {
  const id = useSearchParams().get("id") ?? ""
  const { allowed } = useSession()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<StatusAction | "reveal" | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  // the id the page is showing right now: a slower reply for a previous id must never replace the current shop's data,
  // because Suspend / Reveal act on the shop on screen
  const currentId = useRef(id)
  currentId.current = id

  const load = useCallback(async () => {
    if (!UUID.test(id)) {
      setError("That shop link is not valid.")
      return
    }
    try {
      const d = await call("tenants.get", { id })
      if (currentId.current !== id) return
      setDetail(d)
      setError(null)
    } catch (e) {
      if (currentId.current === id) setError(friendlyError(e))
    }
  }, [id])

  useEffect(() => {
    setDetail(null)
    setFlash(null)
    void load()
  }, [load])

  const t = detail?.tenant
  const canChange = allowed("tenant.suspend")
  const status = t?.status

  return (
    <Shell>
      <p className="mb-3 text-sm">
        <Link href="/tenants/" className="text-[var(--brand)] underline">
          ← All shops
        </Link>
      </p>
      <ErrorNote message={error} />
      {flash ? (
        <p role="status" className="mb-4 rounded border border-[var(--ok)] px-3 py-2 text-sm text-[var(--ok)]">
          {flash}
        </p>
      ) : null}

      {!t && !error ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {t && detail ? (
        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{t.name}</h1>
            <StatusBadge status={t.status} />
            <div className="ml-auto flex flex-wrap gap-2">
              {canChange && status && status !== "suspended" && status !== "read_only" && status !== "deleted" && status !== "pending_deletion" ? (
                <button type="button" className={btnCls} onClick={() => setDialog("read_only")}>
                  Make read-only
                </button>
              ) : null}
              {canChange && status && status !== "suspended" && status !== "deleted" && status !== "pending_deletion" ? (
                <button type="button" className={btnCls} onClick={() => setDialog("suspend")}>
                  Suspend
                </button>
              ) : null}
              {canChange && (status === "suspended" || status === "read_only") ? (
                <button type="button" className={btnCls} onClick={() => setDialog("reactivate")}>
                  Reactivate
                </button>
              ) : null}
            </div>
          </header>

          <section aria-labelledby="overview-h">
            <h2 id="overview-h" className="mb-3 text-lg font-semibold">
              Overview
            </h2>
            <dl className="flex flex-col gap-2">
              <Row label="Shop ID">
                <span className="font-mono text-xs">{t.id}</span>
              </Row>
              <Row label="Type">{t.kind}</Row>
              <Row label="Address">{t.address ?? "—"}</Row>
              <Row label="Created">{formatDhaka(t.createdAt)}</Row>
              <Row label="Trial ends">{formatDhaka(t.trialEndsAt)}</Row>
              <Row label="Grandfathered">{t.grandfathered ? "Yes" : "No"}</Row>
              <Row label="Last sync">
                {formatRelative(t.lastSyncAt)} <span className="text-[var(--muted)]">({formatDhaka(t.lastSyncAt)})</span>
              </Row>
              <Row label="Last data received">{formatDhaka(t.lastEventAt)}</Row>
              <Row label="Devices">{t.deviceCount}</Row>
              <Row label="Status changed">{formatDhaka(t.statusChangedAt)}</Row>
              <Row label="Owner notice">{t.statusMessage ?? "—"}</Row>
              <Row label="Read-only since">{formatDhaka(t.readOnlySince)}</Row>
            </dl>
          </section>

          {allowed("billing.read") ? <BillingPanel key={t.id} tenantId={t.id} tenantName={t.name} onChanged={() => void load()} /> : null}

          <section aria-labelledby="people-h">
            <div className="mb-3 flex items-center gap-3">
              <h2 id="people-h" className="text-lg font-semibold">
                People
              </h2>
              {allowed("tenant.reveal_phone") ? (
                <button type="button" className={btnCls} onClick={() => setDialog("reveal")}>
                  Show full phone numbers
                </button>
              ) : null}
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {detail.staff.map((s, i) => (
                <li key={`${s.phoneMasked}-${i}`}>
                  {s.name} <span className="text-[var(--muted)]">({s.role}{s.active ? "" : ", inactive"})</span> · <span className="font-mono">{s.phoneMasked}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="devices-h">
            <h2 id="devices-h" className="mb-3 text-lg font-semibold">
              Devices
            </h2>
            {detail.devices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No devices registered.</p>
            ) : (
              <ul className="text-sm">
                {detail.devices.map((d) => (
                  <li key={d.code}>
                    Device {d.code} · registered {formatDhaka(d.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-h">
            <h2 id="history-h" className="mb-3 text-lg font-semibold">
              Status history
            </h2>
            {detail.statusHistory.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No status changes.</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {detail.statusHistory.map((h) => (
                  <li key={`${h.at}-${h.toStatus}`} className="rounded border border-[var(--line)] bg-[var(--surface)] p-3">
                    <p>
                      {h.fromStatus} → <strong>{h.toStatus}</strong> · {formatDhaka(h.at)} · {h.adminName ?? "Unknown"}
                    </p>
                    <p className="text-[var(--muted)]">Reason: {h.reason}</p>
                    {h.message ? <p lang="bn">Owner notice: {h.message}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="errors-h">
            <h2 id="errors-h" className="mb-3 text-lg font-semibold">
              Recent app errors
            </h2>
            {detail.recentErrors.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">None reported.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {detail.recentErrors.map((e) => (
                  <li key={e.fingerprint}>
                    {e.kind}: {e.message} · {e.count}× · last {formatDhaka(e.lastAt)}
                    {e.appVersion ? ` · v${e.appVersion}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <NotesPanel tenantId={t.id} canWrite={allowed("tenant.notes.write")} />

          <p className="text-sm">
            <Link href={`/audit/?storeId=${t.id}`} className="text-[var(--brand)] underline">
              View audit log for this shop
            </Link>
          </p>

          {dialog && dialog !== "reveal" ? (
            <StatusDialog
              open
              action={dialog}
              tenantId={t.id}
              tenantName={t.name}
              onClose={() => setDialog(null)}
              onDone={(r) => {
                setDialog(null)
                setFlash(`Status changed from ${r.fromStatus} to ${r.toStatus}.`)
                void load()
              }}
            />
          ) : null}
          <RevealDialog open={dialog === "reveal"} tenantId={t.id} onClose={() => setDialog(null)} />
        </div>
      ) : null}
    </Shell>
  )
}

export default function TenantViewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading…</p>}>
      <TenantView />
    </Suspense>
  )
}
