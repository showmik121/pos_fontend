// পণ্য তৈরির পর বিবরণ ও সম্পাদনা পাতা দুই ভাষাতেই ভাঙে না (ফোনে English মোডে বিবরণ পাতা ক্র্যাশ করেছিল)
import { expect, test } from "@playwright/test"
import { emptyDb } from "../src/lib/store/db"
import { mockApi, seedStore } from "./support"

for (const lang of ["en", "bn"] as const) {
  for (const barcode of ["", "eyJpdGVtcyI6W3sicHJvZHVjdElkIjoiMzI0MiJ9XX0="]) {
    test(`পণ্য যোগ → বিবরণ → সম্পাদনা (${lang}, বারকোড ${barcode ? "লম্বা" : "নেই"})`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(`${e.name}: ${e.message}`))
      await mockApi(page, { role: "owner", kind: "cosmetics" })
      await seedStore(page, { role: "owner", kind: "cosmetics", db: emptyDb() })
      await page.addInitScript((l) => localStorage.setItem("pos.lang.v1", l), lang)

      await page.goto("/products/new/")
      await page.locator("#p-name").fill("Step-stirt")
      if (barcode) await page.locator("#p-barcode").fill(barcode)
      await page.locator("#p-cost").fill("400")
      await page.locator("#p-price").fill("700")
      await page.locator("form, body").first().getByRole("button", { name: lang === "en" ? "Save product" : "পণ্য সেভ করুন" }).click()
      await expect(page).toHaveURL(/\/products\/detail\/\?id=/)
      await page.waitForTimeout(500)
      expect(await page.getByRole("alert").count(), `বিবরণ পাতা ক্র্যাশ: ${errors.join(" | ")}`).toBe(0)
      expect(errors).toEqual([])

      await page.getByRole("link", { name: lang === "en" ? "Edit" : "সম্পাদনা" }).click()
      await expect(page).toHaveURL(/\/products\/edit\/\?id=/)
      await page.waitForTimeout(500)
      expect(await page.getByRole("alert").count(), `সম্পাদনা পাতা ক্র্যাশ: ${errors.join(" | ")}`).toBe(0)
      expect(errors).toEqual([])
    })
  }
}
