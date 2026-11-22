import { describe, expect, it } from "vitest"
import { smallSpans } from "../src/components/home/quick-layout"

describe("smallSpans", () => {
  it("৩, ৬ টি হলে সবই ২ ঘর", () => {
    expect(smallSpans(3)).toEqual([2, 2, 2])
    expect(smallSpans(6)).toEqual([2, 2, 2, 2, 2, 2])
  })
  it("৫ টি হলে ৩ + ২ (শেষ দুটি চওড়া)", () => {
    expect(smallSpans(5)).toEqual([2, 2, 2, 3, 3])
  })
  it("৪ টি হলে ২ সারি, ২+২", () => {
    expect(smallSpans(4)).toEqual([3, 3, 3, 3])
  })
  it("১ টি হলে পুরো সারি, ০ হলে খালি", () => {
    expect(smallSpans(1)).toEqual([6])
    expect(smallSpans(0)).toEqual([])
  })
  it("প্রতিটি সারি ৬ ঘর ভরে (১–১০টি)", () => {
    for (let n = 1; n <= 10; n++) expect(smallSpans(n).reduce((a, b) => a + b, 0) % 6).toBe(0)
  })
})
