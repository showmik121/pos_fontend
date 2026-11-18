// মূল পথ: দোকান খোলা → পণ্য → স্টক → নগদ বিল → রসিদ → বাকিতে বিক্রি → বাকি আদায়।
// ব্যাকএন্ড নকল করা হয়েছে (page.route), তাই এটি শুধু ফ্রন্টএন্ড ও ফোনের ডেটা স্তর যাচাই করে; আসল API-র সাথে মেলানো এখানে নেই।
import { expect, test, type Page } from "@playwright/test"

const STORE = { id: "11111111-1111-4111-8111-111111111111", name: "সবুজ কসমেটিক্স", kind: "cosmetics" }
const USER = { id: "22222222-2222-4222-8222-222222222222", storeId: STORE.id, name: "রহিম", phone: "01712345678", role: "owner", active: true }
const TOKEN = "e2e-token"

async function mockApi(page: Page, seen: string[]) {
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^.*\/api/, "")
    seen.push(`${req.method()} ${p}`)
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
    if (req.method() === "POST" && p === "/v1/auth/register-store") return json(201, { token: TOKEN, user: USER })
    if (req.method() === "GET" && p === "/v1/me") return json(200, { user: USER, store: STORE })
    if (req.method() === "POST" && p === "/v1/sync/register-device") return json(200, { code: "A" })
    return json(404, { error: { code: "not_found", message: "e2e: নকল সার্ভারে এই পথ নেই" } })
  })
}

async function addToBill(page: Page, search: string, name: string) {
  await page.goto("/sell/")
  await page.getByRole("link", { name: "নাম দিয়ে খুঁজুন" }).click()
  await page.locator("#sell-search").fill(search)
  await page.getByText(name, { exact: true }).click()
  await expect(page).toHaveURL(/\/sell\/$/)
}

test("দোকান খোলা থেকে বাকি আদায় পর্যন্ত", async ({ page }) => {
  const seen: string[] = []
  const pageErrors: string[] = []
  page.on("pageerror", (e) => pageErrors.push(e.message))
  await mockApi(page, seen)

  await test.step("দোকান খুলুন", async () => {
    await page.goto("/signup/")
    await page.locator("#storeName").fill(STORE.name)
    await page.getByRole("radio", { name: "কসমেটিক্স" }).click()
    await page.locator("#ownerName").fill("রহিম")
    await page.locator("#phone").fill("০১৭১২৩৪৫৬৭৮")
    await page.locator("#password").fill("Sobuj#Ghar2026")
    await page.getByRole("button", { name: "দোকান খুলুন" }).click()
    await expect(page.getByRole("heading", { name: STORE.name })).toBeVisible()
    await expect(page.getByText("প্রথম পণ্য যোগ করুন").first()).toBeVisible()
  })

  let productId = ""
  await test.step("পণ্য যোগ", async () => {
    await page.getByRole("link", { name: "প্রথম পণ্য যোগ করুন" }).click()
    await page.locator("#p-name").fill("ফেসওয়াশ")
    await page.locator("#p-cost").fill("180")
    await page.locator("#p-price").fill("240")
    await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
    await expect(page).toHaveURL(/\/products\/detail\/\?id=/)
    productId = new URL(page.url()).searchParams.get("id") ?? ""
    expect(productId).not.toBe("")
  })

  await test.step("স্টকে যোগ (১০ পিস)", async () => {
    await page.goto(`/stock/in/?product=${productId}`)
    await page.locator("#si-qty").fill("10")
    await page.getByRole("button", { name: "স্টকে যোগ করুন" }).click()
    await expect(page).toHaveURL(/\/products\/detail\/\?id=/)
  })

  await test.step("নগদে ২ পিস বিক্রি ও রসিদ", async () => {
    await addToBill(page, "ফেস", "ফেসওয়াশ")
    await page.getByRole("button", { name: "বাড়ান" }).click()
    await page.getByRole("link", { name: "পেমেন্ট নিন" }).click()
    await expect(page.getByText("মোট প্রাপ্য")).toBeVisible()
    await expect(page.getByText("৳ ৪৮০").first()).toBeVisible()
    await expect(page.getByText("হিসাব মিলেছে")).toBeVisible()
    await page.getByRole("button", { name: "বিল সম্পন্ন করুন" }).click()
    await expect(page).toHaveURL(/\/sell\/receipt\/\?id=/)
    await expect(page.getByText("বিল সম্পন্ন হয়েছে।")).toBeVisible()
    await expect(page.getByText("A-১০০১").first()).toBeVisible() // ডিভাইস কোডসহ বিল নম্বর
    await expect(page.getByText("সবুজ কসমেটিক্স").first()).toBeVisible()
    await expect(page.getByText("৳ ৪৮০").first()).toBeVisible()
  })

  await test.step("বাকিতে বিক্রি (১ পিস, ১০০ টাকা নগদ)", async () => {
    await addToBill(page, "ফেস", "ফেসওয়াশ")
    await page.getByRole("link", { name: "পেমেন্ট নিন" }).click()
    await page.locator("#pay-cash").fill("100")
    await expect(page.getByRole("button", { name: "বিল সম্পন্ন করুন" })).toBeDisabled() // কাস্টমার ছাড়া বাকি হয় না
    await page.getByText("কাস্টমার বাছুন", { exact: true }).first().click()
    await page.getByRole("button", { name: "+ নতুন কাস্টমার" }).click()
    await page.locator("#nc-name").fill("করিম")
    await page.getByRole("button", { name: "যোগ করুন", exact: true }).click()
    await expect(page.getByText("বাকি থাকছে ৳ ১৪০")).toBeVisible()
    await page.getByRole("button", { name: "বিল সম্পন্ন করুন" }).click()
    await expect(page).toHaveURL(/\/sell\/receipt\/\?id=/)
    await expect(page.getByText("A-১০০২").first()).toBeVisible()
    await expect(page.getByText("কাস্টমার: করিম")).toBeVisible()
    await expect(page.getByText("বাকি", { exact: true })).toBeVisible()
  })

  await test.step("বাকির খাতা ও পুরো বাকি আদায়", async () => {
    await page.goto("/dues/")
    await expect(page.getByText("৳ ১৪০").first()).toBeVisible()
    await page.getByText("করিম", { exact: true }).click()
    await expect(page).toHaveURL(/\/dues\/customer\/\?id=/)
    await page.getByRole("button", { name: "টাকা জমা নিন" }).click()
    await page.locator("#due-amount").fill("140")
    await page.getByRole("button", { name: "জমা নিন", exact: true }).click()
    await expect(page.getByRole("button", { name: "টাকা জমা নিন" })).toBeDisabled() // বাকি শূন্য
    await expect(page.getByText("জমা", { exact: true })).toBeVisible()
  })

  await test.step("ডেটা ফোনেই থাকে: রিলোডের পর হোমে দুটো বিল", async () => {
    await page.goto("/")
    await expect(page.getByText("বিল #A-১০০২")).toBeVisible()
    await expect(page.getByText("বিল #A-১০০১")).toBeVisible()
  })

  expect(pageErrors).toEqual([])
  // শুধু প্রত্যাশিত API ডাকা হয়েছে (পণ্য, বিল ইত্যাদি সার্ভারে যায় না)
  expect(new Set(seen.map((s) => s.replace(/ .*\?.*/, "")))).toEqual(new Set(["POST /v1/auth/register-store", "GET /v1/me", "POST /v1/sync/register-device"]))
})

test("ভুল ফর্ম: খালি সাইন-আপে বাংলা ত্রুটি, সার্ভারে অনুরোধ যায় না", async ({ page }) => {
  const seen: string[] = []
  await mockApi(page, seen)
  await page.goto("/signup/")
  await page.getByRole("button", { name: "দোকান খুলুন" }).click()
  await expect(page.getByText("দোকানের নাম দিন")).toBeVisible()
  await expect(page.getByText("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে")).toBeVisible()
  expect(seen).toEqual([])
})
