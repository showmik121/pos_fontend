// মেয়াদি ওষুধ ডিলারে ফেরত: কোম্পানি ধরে তালিকা, ক্রেডিটসহ ফেরত, ডিলারের খাতায় জমা, কর্মচারী বোতাম দেখে না।
import { expect, test } from "@playwright/test"
import { createProduct, stockIn } from "../src/lib/store/actions"
import { addDealer } from "../src/lib/store/dealers"
import { emptyDb } from "../src/lib/store/db"
import { dayOffset, mockApi, seedStore, storedDb } from "./support"

const NOW = new Date()

function seededDb() {
  const made = createProduct(emptyDb(), { name: "Napa", unit: "piece", cartonSize: 1, costPoisha: 100, pricePoisha: 120, minStock: 0, category: "", company: "Beximco", barcode: null, open: true }, NOW)
  const stocked = stockIn(made.db, { productId: made.product.id, qty: 50, unit: "piece", batchNo: "N1", expiryDate: dayOffset(40), costPoisha: 100, pricePoisha: null, requireBatchAndExpiry: true }, NOW)
  return addDealer(stocked, { name: "Beximco", phone: "" }, NOW).db
}

test("মালিক ব্যাচ ডিলারে ফেরত দেয়: স্টক থেকে যায়, ক্রেডিট ডিলারের খাতায় জমা হয়, খাতায় নিট ক্ষতি দেখায়", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: seededDb() })
  await page.goto("/stock/expiry/")
  const group = page.getByTestId("return-group")
  await expect(group).toContainText("Beximco")
  await group.getByRole("button", { name: "ফেরত" }).click()
  // কোম্পানির নামে ডিলার থাকায় আগে থেকেই বাছা; ক্রেডিট কেনা দামের সমান বসে
  await expect(page.locator("#return-credit")).toHaveValue("50")
  await page.locator("#return-credit").fill("40")
  await page.getByRole("button", { name: "ফেরত দিন" }).click()
  await expect(page.getByTestId("return-group")).toHaveCount(0)
  await expect(page.getByText(/নিট ক্ষতি/)).toBeVisible()
  const db = await storedDb(page)
  expect(db?.batches).toHaveLength(0)
  expect(db?.removedBatches?.[0]).toMatchObject({ reason: "ডিলারে ফেরত", returnedToDealerName: "Beximco", creditPoisha: 4000 })
  expect(db?.dealerEntries?.[0]).toMatchObject({ kind: "payment", amount: 4000 })
})

test("কর্মচারী ফেরতের তালিকা দেখে, কিন্তু ফেরত বোতাম পায় না", async ({ page }) => {
  await mockApi(page, { role: "staff", kind: "pharmacy" })
  await seedStore(page, { role: "staff", kind: "pharmacy", db: seededDb() })
  await page.goto("/stock/expiry/")
  await expect(page.getByTestId("return-group")).toContainText("Napa")
  await expect(page.getByRole("button", { name: "ফেরত" })).toHaveCount(0)
})
