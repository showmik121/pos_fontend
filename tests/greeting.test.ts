import { describe, expect, it } from "vitest"
import { greetingBn } from "../src/lib/format/datetime"

describe("greetingBn", () => {
  it.each([
    [4, "শুভ সকাল"],
    [11, "শুভ সকাল"],
    [12, "শুভ দুপুর"],
    [15, "শুভ দুপুর"],
    [16, "শুভ বিকাল"],
    [17, "শুভ বিকাল"],
    [18, "শুভ সন্ধ্যা"],
    [19, "শুভ সন্ধ্যা"],
    [20, "শুভ রাত্রি"],
    [23, "শুভ রাত্রি"],
    [0, "শুভ রাত্রি"],
    [3, "শুভ রাত্রি"],
  ])("ঘণ্টা %i → %s", (hour, expected) => {
    expect(greetingBn(hour)).toBe(expected)
  })
})
