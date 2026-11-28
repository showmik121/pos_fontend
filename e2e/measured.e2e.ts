// কেজি/লিটারে বিক্রি (মুদি): পণ্য বানানো, ওজন দিয়ে বিল, রসিদে "কেজি" লেখা।
import { expect, test } from "@playwright/test"
import { createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { mockApi, seedStore, storedDb } from "./support"

function dbWithRice() {
  const now = new Date()
  const made = createProduct(emptyDb(), { name: "Minikit Rice", unit: "piece", cartonSize: 1, costPoisha: 70, pricePoisha: 85, minStock: 0, category: "", barcode: null, open: true, measure: "kg" }, now)
  const db = stockIn(made.db, { productId: made.product.id, qty: 5000, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 70, pricePoisha: null, requireBatchAndExpiry: false }, now)
  return { db, id: made.product.id }
}

test("কেজির পণ্য বানানো: প্রতি কেজি দাম ও কেজিতে স্টক সংরক্ষিত হয়", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "other" })
  await seedStore(page, { role: "owner", kind: "other", db: emptyDb() })
  await page.goto("/products/new/")
  await page.locator("#p-name").fill("Chini")
  await page.getByRole("radio", { name: "কেজি" }).click()
  await page.locator("#p-price").fill("120")
  await page.locator("#p-cost").fill("100")
  await page.locator("#p-stock").fill("25.5")
  await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
  await expect(page).toHaveURL(/products\/detail/)
  await expect(page.getByText("৳ ১২০/কেজি").first()).toBeVisible()
  const stored = await storedDb(page)
  expect(stored?.products[0]).toMatchObject({ measure: "kg", pricePoisha: 120, costPoisha: 100 })
  expect(stored?.batches.reduce((n, b) => n + b.qtyRemaining, 0)).toBe(2550)
})

test("খুঁজে ২৫০ গ্রাম যোগ, ওজন ২.৫ কেজি করা, বিল শেষ; রসিদে প্রতি কেজি দাম ও ওজন", async ({ page }) => {
  const { db } = dbWithRice()
  await mockApi(page, { role: "owner", kind: "other" })
  await seedStore(page, { role: "owner", kind: "other", db })
  await page.goto("/sell/search/")
  await page.getByText("Minikit Rice").click()
  await page.getByRole("button", { name: "২৫০ গ্রাম" }).click()
  await expect(page).toHaveURL(/\/sell\/?$/)
  await expect(page.getByText("প্রতি কেজি ৳ ৮৫").first()).toBeVisible()
  let stored = await storedDb(page)
  expect(stored?.draft.lines[0]?.qty).toBe(25)

  await page.locator("[id^=mq-]").fill("2.5")
  await page.locator("[id^=mq-]").press("Enter")
  stored = await storedDb(page)
  expect(stored?.draft.lines[0]?.qty).toBe(250)
  await expect(page.getByText("২.৫ কেজি").first()).toBeVisible()
})

test("কর্মচারী ওজন ভুল লিখলে বার্তা আসে, বিলের পরিমাণ বদলায় না", async ({ page }) => {
  const { db, id } = dbWithRice()
  const withLine = { ...db, draft: { ...db.draft, lines: [{ productId: id, qty: 100, discount: 0 }] } }
  await mockApi(page, { role: "staff", kind: "other" })
  await seedStore(page, { role: "staff", kind: "other", db: withLine })
  await page.goto("/sell/")
  await page.locator("[id^=mq-]").fill("abc")
  await page.locator("[id^=mq-]").press("Enter")
  await expect(page.getByText("সংখ্যা ঠিকভাবে দিন")).toBeVisible()
  expect((await storedDb(page))?.draft.lines[0]?.qty).toBe(100)
})
