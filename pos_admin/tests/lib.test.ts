import { describe, expect, it } from "vitest"
import { formatDhaka, formatRelative } from "@/lib/format"
import { listQueryFromParams, listQueryToParams } from "@/lib/tenant-query"

describe("formatDhaka", () => {
  it("shows Asia/Dhaka time (UTC+6), not UTC or the browser zone", () => {
    expect(formatDhaka("2026-03-01T18:30:00.000Z")).toBe("2 Mar 2026, 12:30 AM")
  })
  it("shows a dash for null or garbage instead of throwing", () => {
    expect(formatDhaka(null)).toBe("—")
    expect(formatDhaka("not a date")).toBe("—")
  })
})

describe("formatRelative", () => {
  const now = Date.parse("2026-03-10T12:00:00.000Z")
  it("says never for null", () => expect(formatRelative(null, now)).toBe("Never"))
  it("buckets minutes, hours, days", () => {
    expect(formatRelative("2026-03-10T11:59:40.000Z", now)).toBe("Just now")
    expect(formatRelative("2026-03-10T11:15:00.000Z", now)).toBe("45 min ago")
    expect(formatRelative("2026-03-10T07:00:00.000Z", now)).toBe("5 h ago")
    expect(formatRelative("2026-03-05T12:00:00.000Z", now)).toBe("5 days ago")
  })
})

describe("tenant list URL <-> query (bookmarkable)", () => {
  it("round-trips every filter", () => {
    const q = listQueryFromParams(new URLSearchParams("q=sobuj&status=suspended&kind=pharmacy&noSyncDays=3&sort=name&dir=asc&cursor=bzoxMDA"))
    expect(q).toMatchObject({ q: "sobuj", status: "suspended", kind: "pharmacy", noSyncDays: 3, sort: "name", dir: "asc", cursor: "bzoxMDA", limit: 50 })
    expect(listQueryToParams(q).toString()).toBe("q=sobuj&status=suspended&kind=pharmacy&noSyncDays=3&sort=name&dir=asc&cursor=bzoxMDA")
  })
  it("omits defaults so the plain list has a clean URL", () => {
    expect(listQueryToParams(listQueryFromParams(new URLSearchParams())).toString()).toBe("")
  })
  it("ignores invalid values instead of crashing (a hand-edited URL)", () => {
    const q = listQueryFromParams(new URLSearchParams("status=bogus&noSyncDays=-4&sort=hax&limit=9999&kind=%00"))
    expect(q).toMatchObject({ sort: "created", dir: "desc", limit: 50 })
    expect(q.status).toBeUndefined()
    expect(q.noSyncDays).toBeUndefined()
    expect(q.kind).toBeUndefined()
  })
})
