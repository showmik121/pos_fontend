// বিলে দাম এক ট্যাপে বদল: শুধু মালিক দেখে; বিলের দাম বদলায়, ইচ্ছে করলে তালিকা-দামও।
import { expect, test } from "@playwright/test"
import { addToCart, createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { mockApi, seedStore, storedDb } from "./support"

function dbWithSoap() {
  const now = new Date()
  const made = createProduct(emptyDb(), { name: "Lux Soap", unit: "piece", cartonSize: 1, costPoisha: 1000, pricePoisha: 2400, minStock: 0, category: "", barcode: null, open: true }, now)
  const db = stockIn(made.db, { productId: made.product.id, qty: 10, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 1000, pricePoisha: null, requireBatchAndExpiry: false }, now)
  return { db: { ...db, draft: addToCart(db.draft, made.product.id, 2) }, id: made.product.id }
}

test("মালিক বিলের লাইনে দাম বদলায়; তালিকা-দাম বদলায় না, মোট নতুন দামে", async ({ page }) => {
  const { db } = dbWithSoap()
  await mockApi(page, { role: "owner", kind: "cosmetics" })
  await seedStore(page, { role: "owner", kind: "cosmetics", db })
  await page.goto("/sell/")
  await page.getByRole("button", { name: "দাম বদলান" }).click()
  await page.locator("#line-price").fill("20")
  await page.getByRole("button", { name: "দাম বসান" }).click()
  await expect(page.getByText("(বদলানো)")).toBeVisible()
  await expect(page.getByText("৳ ৪০", { exact: true }).first()).toBeVisible()
  const stored = await storedDb(page)
  expect(stored?.draft.lines[0]?.unitPrice).toBe(2000)
  expect(stored?.products[0]?.pricePoisha).toBe(2400)
})

test("\"পণ্যের দামও রাখুন\" বাছলে তালিকা-দাম বদলায়, বিলের লাইন আবার তালিকা-দামে", async ({ page }) => {
  const { db } = dbWithSoap()
  await mockApi(page, { role: "owner", kind: "cosmetics" })
  await seedStore(page, { role: "owner", kind: "cosmetics", db })
  await page.goto("/sell/")
  await page.getByRole("button", { name: "দাম বদলান" }).click()
  await page.locator("#line-price").fill("30")
  await page.getByText("এই পণ্যের দামও এটাই রাখুন").click()
  await page.getByRole("button", { name: "দাম বসান" }).click()
  const stored = await storedDb(page)
  expect(stored?.products[0]?.pricePoisha).toBe(3000)
  expect(stored?.draft.lines[0]?.unitPrice).toBeUndefined()
})

test("কর্মচারী বিলে দাম বদলাতে পারে না", async ({ page }) => {
  const { db } = dbWithSoap()
  await mockApi(page, { role: "staff", kind: "cosmetics" })
  await seedStore(page, { role: "staff", kind: "cosmetics", db })
  await page.goto("/sell/")
  await expect(page.getByText("Lux Soap")).toBeVisible()
  await expect(page.getByRole("button", { name: "দাম বদলান" })).toHaveCount(0)
})
