import { describe, expect, it } from "vitest"
import { DISMISS_DAYS, isDismissedRecently, isIosSafari } from "../src/lib/pwa/install"
import { INSTALL_GUIDES } from "../src/components/landing/landing-content"

const DAY = 86_400_000
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1"
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

describe("isIosSafari", () => {
  it("আইফোনের Safari-তে সত্য", () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true)
  })
  it("আইফোনের Chrome-এ মিথ্যা, কারণ সেখানে Add to Home Screen এভাবে নেই", () => {
    expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false)
  })
  it("অ্যান্ড্রয়েডে মিথ্যা", () => {
    expect(isIosSafari(ANDROID_CHROME, 5)).toBe(false)
  })
  it("টাচ-ছাড়া ম্যাকে মিথ্যা, টাচওয়ালা (আইপ্যাড-ম্যাক ছদ্মবেশ) ডিভাইসে সত্য", () => {
    expect(isIosSafari(MAC_SAFARI, 0)).toBe(false)
    expect(isIosSafari(MAC_SAFARI, 5)).toBe(true)
  })
})

describe("isDismissedRecently", () => {
  const now = 1_800_000_000_000
  it("কিছু সংরক্ষিত না থাকলে মিথ্যা", () => {
    expect(isDismissedRecently(null, now)).toBe(false)
    expect(isDismissedRecently("", now)).toBe(false)
    expect(isDismissedRecently("abc", now)).toBe(false)
  })
  it("সীমার ভেতরে সত্য, সীমা পেরোলে মিথ্যা", () => {
    expect(isDismissedRecently(String(now - (DISMISS_DAYS - 1) * DAY), now)).toBe(true)
    expect(isDismissedRecently(String(now - (DISMISS_DAYS + 1) * DAY), now)).toBe(false)
  })
})

describe("ইনস্টলের নির্দেশিকা", () => {
  it("অ্যান্ড্রয়েড ও আইফোন, দুটোর তিন ধাপ করে", () => {
    expect(INSTALL_GUIDES).toHaveLength(2)
    for (const g of INSTALL_GUIDES) expect(g.steps).toHaveLength(3)
  })
})
