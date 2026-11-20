"use client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState, type ReactNode } from "react"
import type { ClientErrorRow, ClientErrorsQuery, ErrorTriageResult, NegativeStockRow, SyncHealthRow } from "@/contract/admin-api"
import { Shell } from "@/components/shell"
import { TriageDialog } from "@/components/triage-dialog"
import { btnCls, ErrorNote, Field, inputCls, StatusBadge } from "@/components/ui"
import { call } from "@/lib/api"
import { formatDhaka, formatRelative } from "@/lib/format"
import { ERROR_STATUS_LABEL, formatHours, HEALTH_TABS, parseTab } from "@/lib/health"
import { useSession } from "@/lib/session"
import { useLoad } from "@/lib/use-load"

function TableShell({ caption, head, children, empty }: { caption: string; head: string[]; children: ReactNode; empty: string | null }) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--line)] bg-[var(--surface)]">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-[var(--line)] text-[var(--muted)]">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-[var(--muted)]">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

const shopLink = (id: string, name: string) => (
  <Link href={`/tenants/view/?id=${id}`} className="font-medium text-[var(--brand)] underline">
    {name}
  </Link>
)

function SyncTab() {
  const [hours, setHours] = useState(24)
  const { data, error, loading } = useLoad((signal) => call("health.sync", { input: { stuckHours: hours }, signal }), `sync:${hours}`)
  const rows: SyncHealthRow[] = data?.tenants ?? []
  return (
    <>
      <div className="mb-4 max-w-xs">
        <Field label="Stuck after">
          {(id) => (
            <select id={id} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputCls}>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </select>
          )}
        </Field>
      </div>
      <ErrorNote message={error} />
      <p className="mb-2 text-sm text-[var(--muted)]" aria-live="polite">
        {loading ? "Loading…" : data ? `${data.total.toLocaleString("en-US")} shop${data.total === 1 ? "" : "s"} with no sync for ${formatHours(data.stuckHours)} or more${data.total > rows.length ? ` (showing the ${rows.length} longest)` : ""}` : ""}
      </p>
      <TableShell caption="Shops whose sync is stuck" head={["Shop", "Status", "Last sync", "Time since sync"]} empty={!loading && !error && rows.length === 0 ? "No shop is stuck." : null}>
        {rows.map((t) => (
          <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
            <td className="px-3 py-2">{shopLink(t.id, t.name)}</td>
            <td className="px-3 py-2">
              <StatusBadge status={t.status} />
            </td>
            <td className="px-3 py-2" title={formatDhaka(t.lastSyncAt ?? t.createdAt)}>
              {t.lastSyncAt ? formatRelative(t.lastSyncAt) : "Never synced"}
            </td>
            <td className="px-3 py-2 tabular-nums">{formatHours(t.hoursSinceSync)}</td>
          </tr>
        ))}
      </TableShell>
    </>
  )
}

function ErrorsTab() {
  const { allowed } = useSession()
  const canTriage = allowed("health.triage")
  const [status, setStatus] = useState<ClientErrorsQuery["status"]>("open")
  const [triaging, setTriaging] = useState<ClientErrorRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { data, error, loading, reload } = useLoad((signal) => call("health.errors", { input: { status }, signal }), `errors:${status}`)
  const rows: ClientErrorRow[] = data?.errors ?? []

  function done(r: ErrorTriageResult) {
    setTriaging(null)
    setNotice(`Marked as ${ERROR_STATUS_LABEL[r.status].toLowerCase()}.`)
    reload()
  }

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Field label="Show">
          {(id) => (
            <select id={id} value={status} onChange={(e) => setStatus(e.target.value as ClientErrorsQuery["status"])} className={inputCls}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
              <option value="all">All</option>
            </select>
          )}
        </Field>
      </div>
      <ErrorNote message={error} />
      {notice ? (
        <p role="status" className="mb-3 rounded border border-[var(--line)] px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <p className="mb-2 text-sm text-[var(--muted)]" aria-live="polite">
        {loading ? "Loading…" : `${rows.length} error${rows.length === 1 ? "" : "s"}`}
      </p>
      <TableShell caption="App errors reported by phones" head={["Error", "Seen", "Version", "Status", ...(canTriage ? ["Action"] : [])]} empty={!loading && !error && rows.length === 0 ? "No errors here." : null}>
        {rows.map((r) => (
          <tr key={r.fingerprint} className="border-b border-[var(--line)] align-top last:border-0">
            <td className="px-3 py-2">
              {/* plain text: React escapes it, and crash text is attacker-writable */}
              <div className="max-w-md break-words font-medium">{r.message}</div>
              <div className="max-w-md text-xs text-[var(--muted)]">
                <span className="break-words [overflow-wrap:anywhere]">
                  {r.kind}
                  {r.path ? ` · ${r.path}` : ""}
                </span>
              </div>
              {r.note ? <div className="mt-1 break-words text-xs">Note: {r.note}</div> : null}
              {r.firstStoreId ? (
                <div className="mt-1 text-xs">
                  First reported by{" "}
                  <Link href={`/tenants/view/?id=${r.firstStoreId}`} className="text-[var(--brand)] underline">
                    this shop
                  </Link>
                </div>
              ) : null}
            </td>
            <td className="px-3 py-2">
              <div className="tabular-nums">{r.count.toLocaleString("en-US")}×</div>
              <div className="text-xs text-[var(--muted)]" title={`First: ${formatDhaka(r.firstAt)}`}>
                Last {formatRelative(r.lastAt)}
              </div>
            </td>
            <td className="px-3 py-2 font-mono text-xs break-all">{r.appVersion ?? "—"}</td>
            <td className="px-3 py-2">{ERROR_STATUS_LABEL[r.status]}</td>
            {canTriage ? (
              <td className="px-3 py-2">
                <button type="button" className={btnCls} onClick={() => setTriaging(r)}>
                  Triage
                </button>
              </td>
            ) : null}
          </tr>
        ))}
      </TableShell>
      <TriageDialog error={triaging} onClose={() => setTriaging(null)} onDone={done} />
    </>
  )
}

function NegativeTab() {
  const { data, error, loading } = useLoad((signal) => call("health.negativeStock", { signal }), "negative")
  const rows: NegativeStockRow[] = data?.tenants ?? []
  return (
    <>
      <ErrorNote message={error} />
      <p className="mb-2 text-sm text-[var(--muted)]" aria-live="polite">
        {loading ? "Loading…" : data ? `${data.total.toLocaleString("en-US")} shop${data.total === 1 ? "" : "s"} with stock below zero${data.total > rows.length ? ` (showing the ${rows.length} worst)` : ""}` : ""}
      </p>
      <TableShell caption="Shops with negative stock" head={["Shop", "Status", "Batches below zero", "Pieces short"]} empty={!loading && !error && rows.length === 0 ? "No shop has negative stock." : null}>
        {rows.map((t) => (
          <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
            <td className="px-3 py-2">{shopLink(t.id, t.name)}</td>
            <td className="px-3 py-2">
              <StatusBadge status={t.status} />
            </td>
            <td className="px-3 py-2 tabular-nums">{t.batches.toLocaleString("en-US")}</td>
            <td className="px-3 py-2 tabular-nums">{t.unitsShort.toLocaleString("en-US")}</td>
          </tr>
        ))}
      </TableShell>
      <p className="mt-2 text-xs text-[var(--muted)]">Counts only. Product names and prices stay in the shop.</p>
    </>
  )
}

function Health() {
  const params = useSearchParams()
  const tab = parseTab(params.get("tab"))
  
  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Health</h1>
      <nav aria-label="Health sections" className="mb-4 flex flex-wrap gap-1">
        {HEALTH_TABS.map((t) => (
          <Link key={t.id} href={`/health/?tab=${t.id}`} replace aria-current={tab === t.id ? "page" : undefined} className={`rounded px-3 py-1.5 text-sm ${tab === t.id ? "bg-[var(--brand)] text-white dark:text-black" : "border border-[var(--control)] hover:border-[var(--brand)]"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "sync" ? <SyncTab /> : tab === "errors" ? <ErrorsTab /> : <NegativeTab />}
    </Shell>
  )
}

export default function HealthPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading…</p>}>
      <Health />
    </Suspense>
  )
}
