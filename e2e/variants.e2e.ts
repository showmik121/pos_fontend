// কসমেটিক্স: একই পণ্যের শেড/সাইজ ভ্যারিয়েন্ট। এক ফ্যামিলিতে বাঁধা, স্টকে এক সারি, "আরেকটি ভ্যারিয়েন্ট" আগে থেকে ভরা ফর্মে।
import { expect, test } from "@playwright/test"
import { emptyDb } from "../src/lib/store/db"
import { mockApi, seedStore, storedDb } from "./support"

test("কসমেটিক্স: দুটি সাইজ যোগ করলে স্টকে এক ফ্যামিলি-সারি, খুললে দুই ভ্যারিয়েন্ট", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "cosmetics" })
  await seedStore(page, { role: "owner", kind: "cosmetics", db: emptyDb() })
  await page.goto("/products/new/")
  await expect(page.locator("#p-generic")).toHaveCount(0) // ওষুধের ঘর নেই
  await page.locator("#p-name").fill("Ponds Cream")
  await page.locator("#p-variant").fill("50ml")
  await page.locator("#p-price").fill("200")
  await page.locator("#p-cost").fill("150")
  await page.getByRole("button", { name: "সেভ করে আরেকটি ভ্যারিয়েন্ট" }).click()

  // পরের ফর্ম: নাম ও দাম ভরা, ভ্যারিয়েন্ট ফাঁকা
  await expect(page).toHaveURL(/products\/new\/?\?from=/)
  await expect(page.locator("#p-name")).toHaveValue("Ponds Cream")
  await expect(page.locator("#p-price")).toHaveValue("200")
  await expect(page.locator("#p-variant")).toHaveValue("")
  await page.locator("#p-variant").fill("100ml")
  await page.locator("#p-price").fill("350")
  await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
  await expect(page).toHaveURL(/products\/detail/)
  // নিজের পাতায় অন্য ভ্যারিয়েন্ট দেখা যায়
  await expect(page.getByText("Ponds Cream-এর অন্য ভ্যারিয়েন্ট")).toBeVisible()

  const stored = await storedDb(page)
  expect(stored?.products.map((p) => p.name).sort()).toEqual(["Ponds Cream · 100ml", "Ponds Cream · 50ml"])

  await page.goto("/stock/")
  await expect(page.getByText("২টি ভ্যারিয়েন্ট")).toBeVisible()
  await expect(page.getByText("100ml", { exact: true })).toHaveCount(0) // গোটানো
  await page.getByText("Ponds Cream", { exact: true }).click()
  await expect(page.getByText("100ml", { exact: true })).toBeVisible()
  await expect(page.getByText("50ml", { exact: true })).toBeVisible()
})

test("একই ভ্যারিয়েন্ট দুবার দিলে বাংলা ত্রুটি", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "cosmetics" })
  await seedStore(page, { role: "owner", kind: "cosmetics", db: emptyDb() })
  for (let i = 0; i < 2; i++) {
    await page.goto("/products/new/")
    await page.locator("#p-name").fill("Ponds Cream")
    await page.locator("#p-variant").fill("50ml")
    await page.locator("#p-price").fill("200")
    await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
  }
  await expect(page.getByText("এই ভ্যারিয়েন্ট আগে থেকেই আছে")).toBeVisible()
})

test("ফার্মেসিতে ভ্যারিয়েন্টের ঘর নেই", async ({ page }) => {
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: emptyDb() })
  await page.goto("/products/new/")
  await expect(page.locator("#p-variant")).toHaveCount(0)
})
