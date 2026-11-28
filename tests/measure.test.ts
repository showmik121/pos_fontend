import { describe, expect, test } from "vitest"
import { formatMeasureQty, measureInputValue, parseMeasureQty, perMeasurePoisha, perPiecePoishaFromMeasure } from "../src/lib/domain/measure"
import { computeCart } from "../src/lib/domain/cart"

describe("কেজি/লিটারের পরিমাণ", () => {
  test("লেখা থেকে পিস: ১০ গ্রামের ধাপ, বাংলা/ইংরেজি অঙ্ক", () => {
    expect(parseMeasureQty("2.5")).toBe(250)
    expect(parseMeasureQty("০.২৫")).toBe(25)
    expect(parseMeasureQty(".5")).toBe(50)
    expect(parseMeasureQty("3")).toBe(300)
    expect(parseMeasureQty("1.05")).toBe(105)
  })
  test("ভুল লেখা, শূন্য, তিন দশমিক আটকায়", () => {
    for (const bad of ["", "abc", "0", "0.00", "1.234", "1..2", "-1", "1e3"]) expect(parseMeasureQty(bad), bad).toBeNull()
  })
  test("ইনপুট ঘরের মান ঘুরে আসে", () => {
    for (const p of [5, 25, 50, 100, 105, 250, 1234]) expect(parseMeasureQty(measureInputValue(p))).toBe(p)
    expect(measureInputValue(250)).toBe("2.5")
    expect(measureInputValue(100)).toBe("1")
  })
  test("পড়ার লেখা: কেজির কম হলে গ্রাম, নইলে কেজি", () => {
    expect(formatMeasureQty(25, "kg")).toBe("২৫০ গ্রাম")
    expect(formatMeasureQty(250, "kg")).toBe("২.৫ কেজি")
    expect(formatMeasureQty(125, "kg")).toBe("১.২৫ কেজি")
    expect(formatMeasureQty(100, "l")).toBe("১ লিটার")
    expect(formatMeasureQty(50, "l")).toBe("৫০০ মি.লি.")
  })
  test("প্রতি কেজি দাম পূর্ণ টাকা হলেই প্রতি-পিস পূর্ণ পয়সা", () => {
    expect(perPiecePoishaFromMeasure(8500)).toBe(85)
    expect(perPiecePoishaFromMeasure(8550)).toBeNull()
    expect(perPiecePoishaFromMeasure(8550, false)).toBe(86)
    expect(perMeasurePoisha(85)).toBe(8500)
  })
  test("বিলের মোট কেজির দাম × কেজির সমান, অন্য হিসাব বদলায় না", () => {
    // ৮৫ টাকা কেজি, ২.৫ কেজি = ২১২.৫০ টাকা
    expect(computeCart([{ unitPrice: 85, qty: 250, discount: 0 }]).total).toBe(21250)
    // ২৫০ গ্রাম = ২১.২৫ টাকা
    expect(computeCart([{ unitPrice: 85, qty: 25, discount: 0 }]).total).toBe(2125)
  })
})
