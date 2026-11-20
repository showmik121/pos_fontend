import { describe, expect, it } from "vitest"
import { buildStatement, STATEMENT_MAX_ROWS } from "../src/lib/store/statement"
import type { LedgerEntry } from "../src/lib/store/types"

const e = (id: string, customerId: string, kind: LedgerEntry["kind"], amount: number, day: number, saleNo: number | null = null): LedgerEntry => ({
  id, customerId, kind, amount, saleNo, by: "", at: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`,
})

describe("খাতার ছবির হিসাব", () => {
  it("পুরনো থেকে নতুন, চলতি বাকিসহ; অন্যের লেনদেন বাদ", () => {
    const s = buildStatement([e("3", "a", "payment", 30000, 5), e("1", "a", "sale", 100000, 1, 1001), e("2", "b", "sale", 999, 2, 1002)], "a")
    expect(s.rows.map((r) => r.balance)).toEqual([100000, 70000])
    expect(s.rows[1]?.amountText.startsWith("−")).toBe(true)
    expect(s.balance).toBe(70000)
    expect(s.skipped).toBe(0)
  })
  it("অনেক লেনদেনে শেষ কয়টিই দেখায়, বাকি সংখ্যা জানায়", () => {
    const many = Array.from({ length: STATEMENT_MAX_ROWS + 5 }, (_, i) => e(String(i), "a", "sale", 100, (i % 28) + 1, 1000 + i))
    const s = buildStatement(many, "a")
    expect(s.rows).toHaveLength(STATEMENT_MAX_ROWS)
    expect(s.skipped).toBe(5)
    expect(s.balance).toBe(100 * many.length)
  })
})
