import { describe, expect, it } from "vitest"
import { afterCreateHref, newProductFromScanHref } from "../src/lib/store/flow"

describe("স্ক্যান করে নতুন পণ্য ও স্টক", () => {
  it("না-পাওয়া বারকোড নতুন-পণ্য পেজে যায়, সঙ্গে স্টকে ফেরার চিহ্ন", () => {
    expect(newProductFromScanHref("8941100")).toBe("/products/new?barcode=8941100&next=stock")
  })
  it("বারকোডের বিশেষ অক্ষর এনকোড হয়", () => {
    expect(newProductFromScanHref("a b&c")).toBe("/products/new?barcode=a%20b%26c&next=stock")
  })
  it("next=stock হলে পণ্য বানানোর পর স্টক-জমা পেজে যায়", () => {
    expect(afterCreateHref("stock", "p1")).toBe("/stock/in?product=p1")
  })
  it("অন্য বা ফাঁকা next হলে আগের মতো পণ্যের বিবরণে যায় (ফাঁকি-লিংক চলে না)", () => {
    expect(afterCreateHref(null, "p1")).toBe("/products/detail?id=p1")
    expect(afterCreateHref("https://evil.example", "p1")).toBe("/products/detail?id=p1")
  })
})
