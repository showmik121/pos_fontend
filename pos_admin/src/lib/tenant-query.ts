// The tenant list lives in the URL (?q=&status=&kind=&noSyncDays=&sort=&dir=&cursor=) so a filtered view can be bookmarked or shared.
// A hand-edited or stale URL must never crash the page: each bad value is dropped on its own and the defaults apply.
import { StoreKindSchema, StoreStatusSchema, TenantListQuerySchema, type TenantListQuery } from "@/contract/admin-api"

const DEFAULTS = TenantListQuerySchema.parse({})

export function listQueryFromParams(params: URLSearchParams): TenantListQuery {
  const raw = (k: string): string | undefined => params.get(k) ?? undefined
  const candidate = {
    q: raw("q"),
    status: StoreStatusSchema.safeParse(raw("status")).data,
    kind: StoreKindSchema.safeParse(raw("kind")).data,
    noSyncDays: raw("noSyncDays"),
    sort: raw("sort"),
    dir: raw("dir"),
    cursor: raw("cursor"),
  }
  // validate each key alone: one bad parameter must not throw away the good ones
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(candidate)) {
    if (v === undefined) continue
    const one = TenantListQuerySchema.safeParse({ [k]: v })
    if (one.success) out[k] = (one.data as Record<string, unknown>)[k]
  }
  return TenantListQuerySchema.parse(out)
}

export function listQueryToParams(q: TenantListQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.q) p.set("q", q.q)
  if (q.status) p.set("status", q.status)
  if (q.kind) p.set("kind", q.kind)
  if (q.noSyncDays !== undefined) p.set("noSyncDays", String(q.noSyncDays))
  if (q.sort !== DEFAULTS.sort) p.set("sort", q.sort)
  if (q.dir !== DEFAULTS.dir) p.set("dir", q.dir)
  if (q.cursor) p.set("cursor", q.cursor)
  return p
}
