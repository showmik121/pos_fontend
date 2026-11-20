import { describe, expect, it } from "vitest"
import { adminContract } from "@/contract/admin-api"
import { buildUrl } from "@/lib/api"
import { formatHours, parseTab } from "@/lib/health"

describe("parseTab", () => {
  it("accepts the three tabs and falls back to sync for anything else", () => {
    expect(parseTab("errors")).toBe("errors")
    expect(parseTab("negative")).toBe("negative")
    expect(parseTab("<script>")).toBe("sync")
    expect(parseTab(null)).toBe("sync")
  })
})

describe("formatHours", () => {
  it("shows hours, then days and the remainder", () => {
    expect(formatHours(5)).toBe("5 h")
    expect(formatHours(24)).toBe("1 day")
    expect(formatHours(30)).toBe("1 day 6 h")
    expect(formatHours(49)).toBe("2 days 1 h")
  })
})

describe("buildUrl", () => {
  it("puts the fingerprint in the path, encoded, and keeps the query for GETs", () => {
    const fp = "a".repeat(32)
    expect(buildUrl(adminContract["health.errors.triage"].path, { fingerprint: fp }, null)).toBe(`/api/v1/admin/health/errors/${fp}/triage`)
    expect(buildUrl(adminContract["health.sync"].path, {}, { stuckHours: 72, limit: "" })).toBe("/api/v1/admin/health/sync?stuckHours=72")
  })
  it("refuses a fingerprint that is not 32 hex characters (no path tricks)", () => {
    for (const bad of ["..", "a/b?c#d", "A".repeat(32), "", "a".repeat(31)]) expect(() => buildUrl(adminContract["health.errors.triage"].path, { fingerprint: bad }, null)).toThrow()
  })
  it("refuses to build a URL with a path parameter left unfilled", () => {
    expect(() => buildUrl(adminContract["health.errors.triage"].path, {}, null)).toThrow(/missing/)
    expect(() => buildUrl(adminContract["tenants.get"].path, {}, null)).toThrow(/missing/)
  })
  it("encodes an id that contains path characters", () => {
    expect(buildUrl(adminContract["tenants.get"].path, { id: "a/b?c#d" }, null)).toBe("/api/v1/admin/tenants/a%2Fb%3Fc%23d")
  })
  it("still resolves :id", () => {
    expect(buildUrl(adminContract["tenants.get"].path, { id: "x y" }, null)).toBe("/api/v1/admin/tenants/x%20y")
  })
})
