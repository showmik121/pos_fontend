import { describe, expect, it } from "vitest"
import { emptyDb, newId } from "../src/lib/store/db"
import { activeCategories, addExpense, addExpenseCategory, categoryTotals, ensureDefaultCategories, expenseTotal, expensesBetween, monthRange, removeExpense, removeExpenseCategory, updateExpense } from "../src/lib/store/expenses"
import { eventsFromChange } from "../src/lib/sync/diff"
import { applyEvents } from "../src/lib/sync/replay"

const NOW = new Date("2026-11-20T10:00:00+06:00")

function setup() {
  const db = ensureDefaultCategories(emptyDb(), NOW)
  return { db, salary: "default:salary", rent: "default:rent" }
}

describe("খরচ", () => {
  it("ডিফল্ট ক্যাটেগরি একবারই বসে, নতুন ক্যাটেগরি যোগ ও মোছা যায়, একই নাম আটকায়", () => {
    const { db } = setup()
    expect(activeCategories(db).map((c) => c.name)).toEqual(["বেতন", "দোকান ভাড়া", "বিদ্যুৎ বিল", "দৈনিক খরচ", "কর্মচারীর খরচ"])
    expect(ensureDefaultCategories(db, NOW)).toBe(db)
    const added = addExpenseCategory(db, { name: " চা-নাস্তা ", icon: "🍵" }, NOW)
    expect(added.category.name).toBe("চা-নাস্তা")
    expect(() => addExpenseCategory(added.db, { name: "বেতন", icon: "" }, NOW)).toThrow()
    expect(() => addExpenseCategory(db, { name: " ", icon: "" }, NOW)).toThrow()
    expect(activeCategories(removeExpenseCategory(added.db, added.category.id))).toHaveLength(5)
  })
  it("খরচ যোগ, বদল, মোছা; ভুল মান আটকায়", () => {
    const { db, salary, rent } = setup()
    expect(() => addExpense(db, { categoryId: salary, amount: 0, note: "", date: "2026-11-20" }, "মালিক", NOW)).toThrow()
    expect(() => addExpense(db, { categoryId: salary, amount: 100, note: "", date: "2026-11-21" }, "মালিক", NOW)).toThrow()
    expect(() => addExpense(db, { categoryId: "nope", amount: 100, note: "", date: "2026-11-20" }, "মালিক", NOW)).toThrow()
    let d = addExpense(db, { categoryId: salary, amount: 1500000, note: " রহিমের ", date: "2026-11-10" }, "মালিক", NOW)
    d = addExpense(d, { categoryId: rent, amount: 800000, note: "", date: "2026-11-05" }, "মালিক", NOW)
    expect(expenseTotal(d, "2026-11-01", "2026-11-30")).toBe(2300000)
    expect(expensesBetween(d, "2026-11-01", "2026-11-30").map((x) => x.categoryId)).toEqual([salary, rent])
    const id = d.expenses![0]!.id
    d = updateExpense(d, id, { categoryId: salary, amount: 1000000, note: "বদল", date: "2026-11-10" }, NOW)
    expect(expenseTotal(d, "2026-11-01", "2026-11-30")).toBe(1800000)
    d = removeExpense(d, id)
    expect(expenseTotal(d, "2026-11-01", "2026-11-30")).toBe(800000)
    expect(() => updateExpense(d, id, { categoryId: salary, amount: 1, note: "", date: "2026-11-10" }, NOW)).toThrow()
  })
  it("ক্যাটেগরি-ভিত্তিক মোট বেশি আগে; মোছা ক্যাটেগরির খরচও নামসহ আসে; মাসের সীমা", () => {
    const { db, salary, rent } = setup()
    let d = addExpense(db, { categoryId: rent, amount: 900, note: "", date: "2026-11-03" }, "ম", NOW)
    d = addExpense(d, { categoryId: salary, amount: 100, note: "", date: "2026-11-04" }, "ম", NOW)
    d = addExpense(d, { categoryId: salary, amount: 50, note: "", date: "2026-10-31" }, "ম", NOW)
    d = removeExpenseCategory(d, rent)
    expect(categoryTotals(d, "2026-11-01", "2026-11-30").map((c) => [c.name, c.total])).toEqual([["দোকান ভাড়া", 900], ["বেতন", 100]])
    expect(monthRange("2026-02-14")).toEqual(["2026-02-01", "2026-02-28"])
  })
  it("ক্যাটেগরি ও খরচ সিংকে অন্য ডিভাইসে পৌঁছায়, মোছাও", () => {
    const before = emptyDb()
    const mid = ensureDefaultCategories(before, NOW)
    const after = addExpense(mid, { categoryId: "default:rent", amount: 500000, note: "নভেম্বর", date: "2026-11-05" }, "মালিক", NOW)
    const out = eventsFromChange(before, after, newId, NOW)
    expect(out.events.filter((e) => e.kind === "expense_category_upserted")).toHaveLength(5)
    expect(out.events.filter((e) => e.kind === "expense_upserted")).toHaveLength(1)
    const other = applyEvents(emptyDb(), out.events).db
    expect(expenseTotal(other, "2026-11-01", "2026-11-30")).toBe(500000)
    const gone = removeExpense(out.db, out.db.expenses![0]!.id)
    const del = eventsFromChange(out.db, gone, newId, new Date("2026-11-20T12:00:00+06:00"))
    expect(expenseTotal(applyEvents(other, del.events).db, "2026-11-01", "2026-11-30")).toBe(0)
  })
})
