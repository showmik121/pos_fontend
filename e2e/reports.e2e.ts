// রিপোর্ট পাতা: সময় বদলানো, খালি অবস্থা, বিলের পর সংখ্যা ও সতর্কতা (মালিক)
import { expect, test } from "@playwright/test"
import { addToCart, completeSale, createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { dayOffset, mockApi, seedStore } from "./support"

test("রিপোর্ট: ডেটা না থাকলে খালি অবস্থা ও 'বিল করুন', সময় বদলানো যায়, ক্র্যাশ নেই", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: emptyDb() })
  await page.goto("/reports/")
  await expect(page.getByText("এই সময়ে কোনো বিক্রি নেই।")).toBeVisible()
  await expect(page.getByRole("link", { name: "বিল করুন" })).toBeVisible()
  for (const name of ["গতকাল", "৭ দিন", "এই মাস", "তারিখ", "আজ"]) {
    await page.getByRole("radio", { name }).click()
    await expect(page.getByRole("radio", { name })).toBeChecked()
  }
  await page.getByRole("radio", { name: "তারিখ" }).click()
  await page.getByRole("button", { name: "আগের দিন" }).click()
  await expect(page.getByRole("button", { name: "পরের দিন" })).toBeEnabled()
  expect(await page.locator("[role=alert]:not(#__next-route-announcer__)").count()).toBe(0)
  expect(errors).toEqual([])
})

test("রিপোর্ট: আজকের বিল দেখায়, গতকালে নেই; কম স্টক/মেয়াদের সতর্কতা আসে", async ({ page }) => {
  const now = new Date()
  let db = emptyDb()
  const made = createProduct(db, { name: "নাপা", unit: "piece", cartonSize: 10, costPoisha: 18000, pricePoisha: 24000, minStock: 50, category: "", barcode: "9001", open: false }, now)
  db = stockIn(made.db, { productId: made.product.id, qty: 10, unit: "piece", batchNo: "B1", expiryDate: dayOffset(10), costPoisha: 18000, pricePoisha: null, requireBatchAndExpiry: false }, now)
  const out = completeSale({ ...db, draft: addToCart(db.draft, made.product.id, 1) }, { cashier: "রুবেল", cash: 24000, mobile: 0, mobileMethod: "bkash" }, now)

  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: out.db })
  await page.goto("/reports/")
  await expect(page.getByText("১টি বিল")).toBeVisible()
  await expect(page.getByText("৳ ২৪০").first()).toBeVisible()
  await expect(page.getByText("সেরা ৫ পণ্য")).toBeVisible()
  await expect(page.getByRole("link", { name: /কম স্টক/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /মেয়াদ শেষ হচ্ছে/ })).toBeVisible()

  await page.getByRole("radio", { name: "গতকাল" }).click()
  await expect(page.getByText("এই সময়ে কোনো বিক্রি নেই।")).toBeVisible()
  await page.getByRole("radio", { name: "এই মাস" }).click()
  await expect(page.getByText("১টি বিল")).toBeVisible()
})
