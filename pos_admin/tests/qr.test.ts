import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { encodeQr, MAX_BYTES } from "../src/lib/qr"

interface Reference {
  text: string
  version: number
  rows: string[]
}
const references = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "qr-reference.json"), "utf8")) as Reference[]

const toRows = (m: boolean[][]) => m.map((r) => r.map((c) => (c ? "1" : "0")).join(""))

describe("QR encoder", () => {
  // The reference encoder (qrcode-terminal) scores masks with its own, non-standard penalty rules, so it may pick a
  // different mask than ours. Every mask is a valid QR code; what must match is the data, error correction, format and
  // version bits — so the reference has to equal our output under exactly one forced mask.
  test.each(references.map((r) => [r.text.slice(0, 40), r] as const))("matches the reference encoder under one mask: %s…", (_name, ref) => {
    expect(ref.rows.length).toBe(ref.version * 4 + 17)
    const matching = [0, 1, 2, 3, 4, 5, 6, 7].filter((mask) => toRows(encodeQr(ref.text, mask)).join("|") === ref.rows.join("|"))
    expect(matching.length).toBe(1)
  })

  test("picks one of the valid masks and keeps the reference size", () => {
    for (const ref of references) expect(encodeQr(ref.text).length).toBe(ref.rows.length)
  })

  test("has the three finder patterns and the dark module", () => {
    const m = encodeQr("hello")
    const n = m.length
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
      expect(m[y]?.[x]).toBe(true)
      expect(m[y + 3]?.[x + 3]).toBe(true)
      expect(m[y + 1]?.[x + 1]).toBe(false)
    }
    expect(m[n - 8]?.[8]).toBe(true)
  })

  test("is deterministic and rejects text over the capacity", () => {
    expect(encodeQr("same")).toEqual(encodeQr("same"))
    expect(() => encodeQr("x".repeat(MAX_BYTES + 1))).toThrow(/too long/)
    expect(encodeQr("x".repeat(MAX_BYTES)).length).toBe(15 * 4 + 17)
  })
})
