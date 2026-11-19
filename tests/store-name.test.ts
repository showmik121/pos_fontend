import { describe, expect, it } from "vitest"
import { STORE_NAME_MAX, cleanStoreName } from "../src/lib/store-name"

describe("cleanStoreName", () => {
  it("দুই পাশের ফাঁকা ও ভেতরের বাড়তি ফাঁকা ছাঁটে", () => {
    expect(cleanStoreName("  রহমান   ফার্মেসি ")).toBe("রহমান ফার্মেসি")
  })
  it("খালি বা শুধু ফাঁকা হলে null", () => {
    expect(cleanStoreName("")).toBeNull()
    expect(cleanStoreName("   ")).toBeNull()
  })
  it("সীমা পর্যন্ত চলে, পেরোলে null", () => {
    expect(cleanStoreName("ক".repeat(STORE_NAME_MAX))).not.toBeNull()
    expect(cleanStoreName("ক".repeat(STORE_NAME_MAX + 1))).toBeNull()
  })
})
