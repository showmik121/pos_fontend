import { describe, expect, it } from "vitest"
import { dateCell, duesReportCsv, salesReportCsv, stockReportCsv, takaCell } from "../src/lib/store/reports"
import type { Db } from "../src/lib/store/types"

const base = { v: 1, products: [], batches: [], customers: [], sales: [], ledger: [], settings: {}, draft: {}, billCounter: 0 } as unknown as Db

describe("reports CSV", () => {
  it("পয়সা টাকায় যায়", () => {
    expect(takaCell(12550)).toBe(125.5)
    expect(takaCell(0)).toBe(0)
  })
  it("ফাইল BOM দিয়ে শুরু ও খালি ডেটায় শুধু শিরোনাম", () => {
    for (const csv of [stockReportCsv(base), salesReportCsv(base), duesReportCsv(base)]) {
      expect(csv.startsWith("﻿")).toBe(true)
      expect(csv.trim().split("\r\n")).toHaveLength(1)
    }
  })
  it("কমা/উদ্ধৃতিচিহ্নযুক্ত নাম ঠিকমতো কোট হয়", () => {
    const db = { ...base, products: [{ id: "p", name: 'পন্ডস "ক্রিম", ১০০', category: "", minStock: 5, costPoisha: 20000, pricePoisha: 24000 }] } as unknown as Db
    expect(stockReportCsv(db)).toContain('"পন্ডস ""ক্রিম"", ১০০"')
  })
  it("বাকির খাতায় আদায় ঋণাত্মক, বাকি ধনাত্মক", () => {
    const db = {
      ...base,
      customers: [{ id: "c", name: "করিম", phone: "", createdAt: "2026-01-01T00:00:00Z" }],
      ledger: [
        { id: "1", customerId: "c", at: "2026-01-02T00:00:00Z", kind: "opening", amount: 50000, saleNo: null, by: "x" },
        { id: "2", customerId: "c", at: "2026-01-03T00:00:00Z", kind: "payment", amount: 20000, saleNo: null, by: "x" },
      ],
    } as unknown as Db
    const lines = duesReportCsv(db).trim().split("\r\n")
    expect(lines[1]).toContain(",500,300")
    expect(lines[2]).toContain(",-200,300")
  })
  it("অবৈধ তারিখে খালি", () => {
    expect(dateCell("xx")).toBe("")
  })
})
