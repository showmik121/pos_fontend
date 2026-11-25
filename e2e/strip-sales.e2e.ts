// ফার্মেসি: পাতা ও খুচরা পিস। পাতার দামে পিসের দাম বসে, পাতা কেটে ২ পিস বিলে যায়, ১ পাতা যোগ হয়, স্টক পাতা/পিসে দেখায়।
import { expect, test } from "@playwright/test"
import { createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { mockApi, seedStore, storedDb } from "./support"

const NOW = new Date()

function dbWithNapa() {
  const made = createProduct(emptyDb(), { name: "Napa", unit: "piece", cartonSize: 100, stripSize: 10, costPoisha: 100, pricePoisha: 120, minStock: 20, category: "", generic: "Paracetamol", barcode: null, open: true }, NOW)
  return stockIn(made.db, { productId: made.product.id, qty: 257, unit: "piece", batchNo: "B1", expiryDate: "2030-06-30", costPoisha: 100, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
}

test("নতুন পণ্যে পাতার মাপ ও পাতার দাম দিলে প্রতি পিসের দাম নিজে বসে", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: emptyDb() })
  await page.goto("/products/new/")
  await page.locator("#p-name").fill("Napa")
  await page.locator("#p-strip").fill("10")
  await page.locator("#p-strip-price").fill("12")
  await expect(page.locator("#p-price")).toHaveValue("1.2")
  await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
  await expect(page).toHaveURL(/products\/detail/)
  const stored = await storedDb(page)
  expect(stored?.products[0]).toMatchObject({ name: "Napa", stripSize: 10, pricePoisha: 120 })
})

test("বিক্রি: পাতা কেটে ২ পিস, তারপর ১ পাতা; বিল ও স্টক পিসের হিসাবে মেলে", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: dbWithNapa() })
  await page.goto("/sell/search/")
  await expect(page.getByText("২৫ পাতা ৭ পিস")).toBeVisible()
  await page.getByText("Napa", { exact: true }).click()
  await page.getByRole("button", { name: "+২ পিস" }).click()
  await expect(page).toHaveURL(/\/sell\/$/)
  await expect(page.getByText("২ পিস", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /\+১ পাতা/ }).click()
  await expect(page.getByText("১ পাতা ২ পিস", { exact: true })).toBeVisible()
  const draft = (await storedDb(page))?.draft.lines[0]
  expect(draft?.qty).toBe(12)
})

test("স্টক-জমায় পাতা বেছে ৩ পাতা দিলে ৩০ পিস যোগ হয়", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  const db = dbWithNapa()
  await seedStore(page, { role: "owner", kind: "pharmacy", db })
  await page.goto(`/stock/in/?product=${db.products[0]?.id}`)
  await page.getByRole("radio", { name: "পাতা" }).click()
  await page.locator("#si-qty").fill("3")
  await page.locator("#si-batch").fill("B2")
  await page.locator("#si-expiry").fill("062031")
  await page.locator("#si-cost").fill("10")
  await page.getByRole("button", { name: "স্টকে যোগ করুন" }).click()
  await expect(page).toHaveURL(/products\/detail/)
  const total = (await storedDb(page))?.batches.reduce((n, b) => n + b.qtyRemaining, 0)
  expect(total).toBe(287)
})
