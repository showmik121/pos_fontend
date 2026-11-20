import { describe, expect, it } from "vitest"
// @ts-expect-error plain .mjs build helper without types
import { buildHeaders, inlineScripts, sha256 } from "../scripts/csp-headers.mjs"

const page = (body: string) => `<html><head></head><body>${body}</body></html>`

describe("strict CSP from built pages", () => {
  it("hashes inline scripts and skips external ones", () => {
    const html = page(`<script src="/_next/a.js"></script><script>self.__next_f.push([1,"x"])</script>`)
    expect(inlineScripts(html)).toEqual([`self.__next_f.push([1,"x"])`])
  })

  it("puts exactly those hashes in script-src, with no unsafe-inline anywhere", () => {
    const body = `self.__next_f.push([1,"x"])`
    const headers: string = buildHeaders([page(`<script>${body}</script>`)], "https://api.example.test")
    expect(headers).toContain(`script-src 'self' ${sha256(body)}`)
    expect(headers).not.toContain("unsafe-inline")
    expect(headers).not.toContain("unsafe-eval")
    expect(headers).toContain("connect-src 'self' https://api.example.test")
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain("default-src 'none'")
  })

  it("dedupes identical scripts across pages", () => {
    const p = page(`<script>same()</script>`)
    const headers: string = buildHeaders([p, p], "")
    expect(headers.match(/sha256-/g)?.length).toBe(1)
  })

  it("refuses inline styles instead of weakening the policy", () => {
    expect(() => buildHeaders([page(`<style>a{}</style>`)], "")).toThrow(/inline style/)
    expect(() => buildHeaders([page(`<div style="color:red"></div>`)], "")).toThrow(/inline style/)
  })
})
