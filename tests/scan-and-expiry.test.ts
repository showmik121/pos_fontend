import { describe, expect, test } from "vitest"
import { formatExpiryInput, normalizeExpiryInput } from "../src/lib/domain/expiry-input"
import { addToQty } from "../src/lib/domain/qty-input"
import { buildVideoConstraints, focusConstraint, pickFormats, torchSupported, zoomRange } from "../src/lib/scan/camera-config"

describe("মেয়াদ লেখার সহায়ক", () => {
  test("দুই অঙ্কের পর নিজে স্ল্যাশ বসায়", () => {
    expect(formatExpiryInput("062027")).toBe("06/2027")
    expect(formatExpiryInput("0627")).toBe("06/27")
    expect(formatExpiryInput("06")).toBe("06")
  })
  test("মাসের প্রথম অঙ্ক ২–৯ হলে শূন্য বসায়", () => {
    expect(formatExpiryInput("7")).toBe("07")
    expect(formatExpiryInput("1")).toBe("1")
  })
  test("বাংলা অঙ্ক ও বাড়তি অক্ষর সামলায়", () => {
    expect(formatExpiryInput("০৬২০২৭")).toBe("06/2027")
    expect(formatExpiryInput("06/20x27999")).toBe("06/2027")
  })
  test("দুই অঙ্কের বছর পূর্ণ বছরে বদলায়", () => {
    expect(normalizeExpiryInput("06/27")).toBe("06/2027")
    expect(normalizeExpiryInput("6/27")).toBe("06/2027")
    expect(normalizeExpiryInput("06/2027")).toBe("06/2027")
    expect(normalizeExpiryInput("")).toBe("")
    expect(normalizeExpiryInput("06/2")).toBe("06/2")
  })
})

describe("পরিমাণ দ্রুত যোগ", () => {
  test("খালি বা বাংলা অঙ্কে যোগ হয়", () => {
    expect(addToQty("", 10)).toBe("10")
    expect(addToQty("৫", 5)).toBe("10")
    expect(addToQty("abc", 1)).toBe("1")
  })
  test("সীমা ছাড়ায় না", () => {
    expect(addToQty("99990", 50)).toBe("100000")
  })
})

describe("ক্যামেরা কনফিগ", () => {
  test("পেছনের ক্যামেরা ও উচ্চ রেজোলিউশন চায়", () => {
    const c = buildVideoConstraints()
    expect(c.facingMode).toEqual({ ideal: "environment" })
    expect((c.width as { ideal: number }).ideal).toBeGreaterThanOrEqual(1280)
  })
  test("শুধু সাপোর্টেড ফরম্যাট বাছে, তালিকা না পেলে ডিফল্ট", () => {
    expect(pickFormats(["qr_code", "ean_13", "aztec"])).toEqual(["ean_13", "qr_code"])
    expect(pickFormats(undefined).length).toBeGreaterThan(3)
    expect(pickFormats([])).toEqual(pickFormats(undefined))
  })
  test("ফোকাস, জুম ও টর্চ শুধু থাকলে", () => {
    expect(focusConstraint({ focusMode: ["manual", "continuous"] })).toEqual({ focusMode: "continuous" })
    expect(focusConstraint({})).toBeNull()
    expect(zoomRange({ zoom: { min: 1, max: 4, step: 0.1 } })).toEqual({ min: 1, max: 4, step: 0.1 })
    expect(zoomRange({ zoom: { min: 1, max: 1, step: 0.1 } })).toBeNull()
    expect(zoomRange({})).toBeNull()
    expect(torchSupported({ torch: true })).toBe(true)
    expect(torchSupported({})).toBe(false)
  })
})

import { expiryAfterYears } from "../src/lib/domain/expiry-input"
import { COMMON_COMPANIES, companyOptions } from "../src/lib/store/companies"

describe("দ্রুত মেয়াদ ও কোম্পানি তালিকা", () => {
  test("আজ থেকে n বছর পরের মাস/বছর", () => {
    expect(expiryAfterYears(2, new Date(2026, 10, 25))).toBe("11/2028")
    expect(expiryAfterYears(1, new Date(2026, 0, 5))).toBe("01/2027")
  })
  test("কোম্পানির তালিকায় আগে ব্যবহার-করা নাম আগে, বড়-ছোট হাতের তফাতে দুবার নয়, বর্তমান মান বাদ পড়ে না", () => {
    const opts = companyOptions({ products: [{ company: "square" }, { company: "Zeta Pharma" }, {}] as never }, "My Local")
    expect(opts.slice(0, 2)).toEqual(["square", "Zeta Pharma"])
    expect(opts.filter((o) => o.toLowerCase() === "square")).toHaveLength(1)
    expect(opts).toContain("My Local")
    expect(opts.length).toBe(COMMON_COMPANIES.length + 2)
  })
})
