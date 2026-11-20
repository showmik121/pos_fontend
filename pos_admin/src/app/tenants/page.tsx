"use client"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react"
import type { z } from "zod"
import { StoreKindSchema, StoreStatusSchema, type ResponseOf, type TenantListQuery } from "@/contract/admin-api"
import { Shell } from "@/components/shell"
import { btnCls, ErrorNote, Field, inputCls, STATUS_LABEL, StatusBadge } from "@/components/ui"
import { call, friendlyError } from "@/lib/api"
import { formatDhaka, formatRelative } from "@/lib/format"
import { listQueryFromParams, listQueryToParams } from "@/lib/tenant-query"

type Page = ResponseOf<"tenants.list">
const KIND_LABEL: Record<z.infer<typeof StoreKindSchema>, string> = { pharmacy: "Pharmacy", cosmetics: "Cosmetics", other: "Other" }

function TenantList() {
  const router = useRouter()
  const params = useSearchParams()
  const query = useMemo(() => listQueryFromParams(new URLSearchParams(params.toString())), [params])
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctl = new AbortController()
    setLoading(true)
    setError(null)
    call("tenants.list", { input: query, signal: ctl.signal })
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

  function go(next: TenantListQuery) {
    const qs = listQueryToParams(next).toString()
    router.push(qs ? `/tenants/?${qs}` : "/tenants/")
  }
  // changing any filter or sort starts again from the first page
  const reset = (patch: Partial<TenantListQuery>) => go({ ...query, ...patch, cursor: undefined })

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const v = String(new FormData(e.currentTarget).get("q") ?? "").trim()
    reset({ q: v || undefined })
  }

  const sortKey = `${query.sort}:${query.dir}`
  const rows = page?.tenants ?? []

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-semibold">Shops</h1>
      <form onSubmit={onSearch} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search" aria-label="Filter shops">
        <Field label="Search" hint="Name, phone or shop ID">
          {(id, d) => <input id={id} aria-describedby={d} name="q" defaultValue={query.q ?? ""} key={query.q ?? ""} className={inputCls} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <select id={id} value={query.status ?? ""} onChange={(e) => reset({ status: StoreStatusSchema.safeParse(e.target.value).data })} className={inputCls}>
              <option value="">All</option>
              {StoreStatusSchema.options.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Type">
          {(id) => (
            <select id={id} value={query.kind ?? ""} onChange={(e) => reset({ kind: StoreKindSchema.safeParse(e.target.value).data })} className={inputCls}>
              <option value="">All</option>
              {StoreKindSchema.options.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Last sync">
          {(id) => (
            <select id={id} value={query.noSyncDays ?? ""} onChange={(e) => reset({ noSyncDays: e.target.value ? Number(e.target.value) : undefined })} className={inputCls}>
              <option value="">Any</option>
              <option value="1">No sync for 1+ day</option>
              <option value="3">No sync for 3+ days</option>
              <option value="7">No sync for 7+ days</option>
              <option value="30">No sync for 30+ days</option>
            </select>
          )}
        </Field>
        <Field label="Sort by">
          {(id) => (
            <select
              id={id}
              value={sortKey}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(":") as [TenantListQuery["sort"], TenantListQuery["dir"]]
                reset({ sort, dir })
              }}
              className={inputCls}
            >
              <option value="created:desc">Newest first</option>
              <option value="created:asc">Oldest first</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="lastSync:asc">Longest since sync</option>
              <option value="lastSync:desc">Most recent sync</option>
              <option value="status:asc">Status</option>
            </select>
          )}
        </Field>
        <div className="sm:col-span-2 lg:col-span-5">
          <button type="submit" className={btnCls}>
            Search
          </button>
        </div>
      </form>

      <ErrorNote message={error} />
      <p className="mb-2 text-sm text-[var(--muted)]" aria-live="polite">
        {loading ? "Loading…" : page ? `${page.total.toLocaleString("en-US")} shop${page.total === 1 ? "" : "s"}` : ""}
      </p>

      <div className="overflow-x-auto rounded border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Shops</caption>
          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-3 py-2">Shop</th>
              <th scope="col" className="px-3 py-2">Owner</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Last sync</th>
              <th scope="col" className="px-3 py-2">Devices</th>
              <th scope="col" className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/tenants/view/?id=${t.id}`} className="font-medium text-[var(--brand)] underline">
                    {t.name}
                  </Link>
                  <div className="text-xs text-[var(--muted)]">{KIND_LABEL[t.kind]}</div>
                </td>
                <td className="px-3 py-2">
                  {t.ownerName ?? "—"}
                  <div className="font-mono text-xs text-[var(--muted)]">{t.ownerPhoneMasked ?? "—"}</div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2" title={formatDhaka(t.lastSyncAt)}>
                  {formatRelative(t.lastSyncAt)}
                </td>
                <td className="px-3 py-2">{t.deviceCount}</td>
                <td className="px-3 py-2">{formatDhaka(t.createdAt)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && !error ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                  No shops match these filters.
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
        <button type="button" className={btnCls} onClick={() => page?.nextCursor && go({ ...query, cursor: page.nextCursor })} disabled={!page?.nextCursor}>
          Next
        </button>
      </nav>
    </Shell>
  )
}

export default function TenantsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Loading…</p>}>
      <TenantList />
    </Suspense>
  )
}
