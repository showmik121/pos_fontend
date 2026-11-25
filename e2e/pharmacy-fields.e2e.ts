// ফার্মেসি: নতুন পণ্যে জেনেরিক/শক্তি/ধরন/কোম্পানি সেভ হয়, আর বাংলা বানানে খুঁজলে পাওয়া যায়। কসমেটিক্সে এই ঘর দেখায় না।
import { expect, test } from "@playwright/test"
import { createProduct, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import { mockApi, seedStore, storedDb, type Kind } from "./support"

const NOW = new Date()

function dbWithNapa() {
  const made = createProduct(emptyDb(), { name: "Napa", unit: "strip", cartonSize: 10, costPoisha: 100, pricePoisha: 120, minStock: 5, category: "", generic: "Paracetamol", strength: "500 mg", form: "tablet", company: "Beximco", barcode: null, open: true }, NOW)
  return stockIn(made.db, { productId: made.product.id, qty: 20, unit: "piece", batchNo: "", expiryDate: null, costPoisha: 100, pricePoisha: null, requireBatchAndExpiry: false }, NOW)
}

async function open(page: import("@playwright/test").Page, kind: Kind, db = emptyDb()) {
  await mockApi(page, { role: "owner", kind })
  await seedStore(page, { role: "owner", kind, db })
}

test("ফার্মেসিতে নতুন পণ্যের ফর্মে ওষুধের ঘর আছে; সেভ করলে তথ্য থাকে", async ({ page }) => {
  await open(page, "pharmacy")
  await page.goto("/products/new/")
  await page.locator("#p-name").fill("Seclo")
  await page.locator("#p-generic").fill("Omeprazole")
  await page.locator("#p-strength").fill("20 mg")
  await page.locator("#p-form").selectOption("capsule")
  await page.locator("#p-company").fill("Square")
  await page.locator("#p-price").fill("6")
  await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
  await expect(page).toHaveURL(/products\/detail/)
  await expect(page.getByText("Omeprazole")).toBeVisible()
  await expect(page.getByText("Square")).toBeVisible()
  const stored = await storedDb(page)
  expect(stored?.products[0]).toMatchObject({ name: "Seclo", generic: "Omeprazole", strength: "20 mg", form: "capsule", company: "Square" })
})

test("কসমেটিক্স দোকানে ওষুধের ঘর দেখায় না", async ({ page }) => {
  await open(page, "cosmetics")
  await page.goto("/products/new/")
  await expect(page.locator("#p-name")).toBeVisible()
  await expect(page.locator("#p-generic")).toHaveCount(0)
})

test("বিক্রির সার্চে জেনেরিক নাম ও বাংলা বানান দুটোতেই পণ্য মেলে, তালিকায় ওষুধের তথ্য দেখায়", async ({ page }) => {
  await open(page, "pharmacy", dbWithNapa())
  await page.goto("/sell/search/")
  for (const q of ["paracetamol", "প্যারাসিটামল", "napa 500", "beximco"]) {
    await page.locator("#sell-search").fill(q)
    await expect(page.getByText("Napa", { exact: true }), q).toBeVisible()
  }
  await expect(page.getByText("Paracetamol 500 mg · ট্যাবলেট · Beximco")).toBeVisible()
  await page.locator("#sell-search").fill("napa 650")
  await expect(page.getByText("কিছু পাওয়া যায়নি")).toBeVisible()
})
