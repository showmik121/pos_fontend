import { describe, expect, it } from "vitest"
// @ts-expect-error plain .mjs build script
import { adminHeaderRules } from "../scripts/embed-admin.mjs"

const STANDALONE = ["/*", "  Content-Security-Policy: default-src 'none'; script-src 'self' 'sha256-abc'", "  Cache-Control: no-store", "", "/_next/static/*", "  Cache-Control: public, max-age=31536000, immutable", ""].join("\n")

describe("adminHeaderRules", () => {
  const out: string = adminHeaderRules(STANDALONE)
  it("moves every rule under /admin so the shop's own headers are untouched", () => {
    expect(out).toContain("/admin/*\n")
    expect(out).toContain("/admin/_next/static/*\n")
    expect(out.split("\n").filter((l) => l.startsWith("/")).every((l) => l.startsWith("/admin/"))).toBe(true)
  })
  it("keeps the panel's strict CSP and adds noindex", () => {
    expect(out).toContain("script-src 'self' 'sha256-abc'")
    expect(out).toContain("X-Robots-Tag: noindex, nofollow")
  })
  it("refuses a headers file without a catch-all block", () => {
    expect(() => adminHeaderRules("/x\n  A: b\n")).toThrow()
  })
})
