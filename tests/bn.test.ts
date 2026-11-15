import { describe, expect, it } from "vitest"
import { toAsciiDigits, toBanglaDigits } from "../src/lib/format/bn"
import { formatPhoneBn, normalizeBdPhone } from "../src/lib/format/phone"

describe("বাংলা অঙ্ক", () => {
  it("ইংরেজি অঙ্ককে বাংলায় বদলায়", () => {
    expect(toBanglaDigits("০১৭ 2026")).toBe("০১৭ ২০২৬")
    expect(toBanglaDigits(430)).toBe("৪৩০")
  })

  it("বাংলা অঙ্ককে ইংরেজিতে বদলায়", () => {
    expect(toAsciiDigits("০১৭১২৩৪৫৬৭৮")).toBe("01712345678")
  })

  it("বাংলা-ইংরেজি ঘুরিয়ে বদলালে মান একই থাকে", () => {
    expect(toAsciiDigits(toBanglaDigits("0123456789"))).toBe("0123456789")
  })
})

describe("মোবাইল নম্বর", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["০১৭১২৩৪৫৬৭৮", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["8801712345678", "01712345678"],
    ["017 1234-5678", "01712345678"],
  ])("%s কে %s করে", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected)
  })

  it.each(["", "123", "01212345678", "0171234567", "017123456789", "abc"])("ভুল নম্বর %s কে বাতিল করে", (input) => {
    expect(normalizeBdPhone(input)).toBeNull()
  })

  it("দেখানোর সময় বাংলা অঙ্কে দেয়", () => {
    expect(formatPhoneBn("01712345678")).toBe("০১৭১২৩৪৫৬৭৮")
  })
})
