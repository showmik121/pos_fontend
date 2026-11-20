"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { AuditListQuerySchema, type AuditListQuery, type ResponseOf } from "@/contract/admin-api"
import { Shell } from "@/components/shell"
import { btnCls, ErrorNote, Field, inputCls } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"
import { formatDhaka } from "@/lib/format"

type Page = ResponseOf<"audit.list">

const OUTCOMES = ["ok", "denied", "error", "started"] as const

function fromParams(p: URLSearchParams): AuditListQuery {
  const out: Record<string, unknown> = {}
  for (const k of ["action", "outcome", "storeId", "adminId", "cursor"]) {
    const v = p.get(k)
    if (v === null) continue
    if (AuditListQuerySchema.safeParse({ [k]: v }).success) out[k] = v
  }
  return AuditListQuerySchema.parse(out)
}

/** before/after are server-chosen small JSON objects; show them as plain "key: value" lines, never raw JSON */
function summarise(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v !== "object") return String(v)
  return Object.entries(v as Record<string, unknown>)
    .map(([k, val]) => `${k}: ${val !== null && typeof val === "object" ? "…" : String(val)}`)
    .join(", ")
}

function AuditList() {
  const router = useRouter()
  const params = useSearchParams()
  const query = useMemo(() => fromParams(new URLSearchParams(params.toString())), [params])
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctl = new AbortController()
    setLoading(true)
    setError(null)
    call("audit.list", { input: query, signal: ctl.signal })
      .then((p) => {
        setPage(p)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(friendlyError(e))
        setLoading(false)
      })
    return () => ctl.abort()
  }, [query])

  function go(patch: Partial<AuditListQuery>, keepCursor = false) {
    const next = new URLSearchParams()
    const merged = { ...query, ...patch, ...(keepCursor ? {} : { cursor: undefined }) }
    for (const k of ["action", "outcome", "storeId", "adminId", "cursor"] as const) {
      const v = merged[k]
      if (v) next.set(k, v)
    }
    const qs = next.toString()
    router.push(qs ? `/audit/?${qs}` : "/audit/")
  }

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Audit log</h1>
      <form
        className="mb-4 grid gap-3 sm:grid-cols-3"
        role="search"
        aria-label="Filter audit log"
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          go({ action: String(f.get("action") ?? "").trim() || undefined, storeId: String(f.get("storeId") ?? "").trim() || undefined })
        }}
      >
        <Field label="Action" hint="For example admin.tenant.suspend">
          {(id, d) => <input id={id} aria-describedby={d} name="action" defaultValue={query.action ?? ""} key={`a-${query.action ?? ""}`} className={inputCls} />}
        </Field>
        <Field label="Shop ID">{(id) => <input id={id} name="storeId" defaultValue={query.storeId ?? ""} key={`s-${query.storeId ?? ""}`} className={inputCls} />}</Field>
        <Field label="Outcome">
          {(id) => (
            <select id={id} value={query.outcome ?? ""} onChange={(e) => go({ outcome: OUTCOMES.find((o) => o === e.target.value) })} className={inputCls}>
              <option value="">All</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="sm:col-span-3">
          <button type="submit" className={btnCls}>
            Apply filters
          </button>
        </div>
      </form>

      <ErrorNote message={error} />
      <p className="mb-2 text-sm text-[var(--muted)]" aria-live="polite">
        {loading ? "Loading…" : page ? `${page.rows.length} entr${page.rows.length === 1 ? "y" : "ies"} shown` : ""}
      </p>

      <div className="overflow-x-auto rounded border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Audit log</caption>
          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-3 py-2">When</th>
              <th scope="col" className="px-3 py-2">Who</th>
              <th scope="col" className="px-3 py-2">Action</th>
              <th scope="col" className="px-3 py-2">Outcome</th>
              <th scope="col" className="px-3 py-2">Target</th>
              <th scope="col" className="px-3 py-2">Reason</th>
              <th scope="col" className="px-3 py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {(page?.rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)] align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2">{formatDhaka(r.at)}</td>
                <td className="px-3 py-2">{r.adminName ?? r.actor}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2">{r.outcome}</td>
                <td className="px-3 py-2 text-xs">{r.targetType ? `${r.targetType} ${r.targetId ?? ""}` : "—"}</td>
                <td className="px-3 py-2">{r.reason ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.before || r.after ? (
                    <>
                      <span>Before: {summarise(r.before)}</span>
                      <br />
                      <span>After: {summarise(r.after)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!loading && (page?.rows.length ?? 0) === 0 && !error ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--muted)]">
                  No entries match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <nav className="mt-4 flex gap-2" aria-label="Pagination">
        <button type="button" className={btnCls} onClick={() => router.back()} disabled={!query.cursor}>
          Previous
        </button>
        <button type="button" className={btnCls} onClick={() => page?.nextCursor && go({ cursor: page.nextCursor }, true)} disabled={!page?.nextCursor}>
          Next
        </button>
      </nav>
    </Shell>
  )
}

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading…</p>}>
      <AuditList />
    </Suspense>
  )
}
