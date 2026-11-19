// মূল পথ: দোকান খোলা → পণ্য → স্টক → নগদ বিল → রসিদ → বাকিতে বিক্রি → বাকি আদায়।
// দুই মোড:
//  • সাধারণ (ডিফল্ট): ব্যাকএন্ড নকল (page.route); শুধু ফ্রন্টএন্ড ও ফোনের ডেটা স্তর যাচাই হয়।
//  • E2E_REAL=1: নকল নেই; অ্যাপ আসল ব্যাকএন্ড (আসল Postgres-এ) ডাকে, তাই API-র চুক্তি, CORS ও ডিভাইস-কোড যাচাই হয়।
import { expect, test, type Page } from "@playwright/test"

const STORE = { id: "11111111-1111-4111-8111-111111111111", name: "সবুজ কসমেটিক্স", kind: "cosmetics" }
const USER = { id: "22222222-2222-4222-8222-222222222222", storeId: STORE.id, name: "রহিম", phone: "01712345678", role: "owner", active: true }
const TOKEN = "e2e-token"
const REAL = process.env.E2E_REAL === "1"
const PASSWORD = "Sobuj#Ghar2026"
const BN = "০১২৩৪৫৬৭৮৯"
const toBn = (v: string) => v.replace(/\d/g, (d) => BN[Number(d)] ?? d)
// আসল সার্ভারে প্রতিবার আলাদা নম্বর (ফোন গ্লোবালি ইউনিক); নকলে স্থির
const PHONE = REAL ? `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}` : "01712345678"

/** অ্যাপ যে /api/v1/... গুলো ডাকে তার তালিকা (নকল বা আসল, দুই মোডেই) */
function recordApi(page: Page): string[] {
  const seen: string[] = []
  page.on("request", (r) => {
    const u = new URL(r.url())
    const i = u.pathname.indexOf("/api/v1/")
    if (i >= 0) seen.push(`${r.method()} ${u.pathname.slice(i + 4)}`)
  })
  return seen
}

async function mockApi(page: Page) {
  if (REAL) return
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^.*\/api/, "")
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
  const seen = recordApi(page)
  const pageErrors: string[] = []
  page.on("pageerror", (e) => pageErrors.push(e.message))
  await mockApi(page)

  await test.step("দোকান খুলুন", async () => {
    await page.goto("/signup/")
    await page.locator("#storeName").fill(STORE.name)
    await page.getByRole("radio", { name: "কসমেটিক্স" }).click()
    await page.locator("#ownerName").fill("রহিম")
    await page.locator("#phone").fill(toBn(PHONE))
    await page.locator("#password").fill(PASSWORD)
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
  const seen = recordApi(page)
  await mockApi(page)
  await page.goto("/signup/")
  await page.getByRole("button", { name: "দোকান খুলুন" }).click()
  await expect(page.getByText("দোকানের নাম দিন")).toBeVisible()
  await expect(page.getByText("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে")).toBeVisible()
  expect(seen).toEqual([])
})

test("আসল সার্ভার: লগআউট → লগইন, ভুল পাসওয়ার্ড, একই নম্বরে দ্বিতীয় দোকান আটকানো", async ({ page }) => {
  test.skip(!REAL, "আসল ব্যাকএন্ড লাগে (E2E_REAL=1)")
  const phone = `018${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`
  const signup = async (name: string) => {
    await page.goto("/signup/")
    await page.locator("#storeName").fill(name)
    await page.locator("#ownerName").fill("রহিম")
    await page.locator("#phone").fill(toBn(phone))
    await page.locator("#password").fill(PASSWORD)
    await page.getByRole("button", { name: "দোকান খুলুন" }).click()
  }

  await signup("প্রথম দোকান")
  await expect(page.getByRole("heading", { name: "প্রথম দোকান" })).toBeVisible()

  await page.goto("/settings/")
  await page.getByRole("button", { name: "লগআউট", exact: true }).click()
  await page.getByRole("button", { name: "লগআউট (ডেটা ফোনে থাকবে)" }).click()
  await expect(page).toHaveURL(/\/login\/$/)

  await page.locator("#phone").fill(toBn(phone))
  await page.locator("#password").fill("ভুল-পাসওয়ার্ড-১")
  await page.getByRole("button", { name: "লগইন করুন" }).click()
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page).toHaveURL(/\/login\/$/)

  await page.locator("#password").fill(PASSWORD)
  await page.getByRole("button", { name: "লগইন করুন" }).click()
  await expect(page.getByRole("heading", { name: "প্রথম দোকান" })).toBeVisible() // সার্ভারের /me থেকে দোকানের নাম

  await page.goto("/settings/")
  await page.getByRole("button", { name: "লগআউট", exact: true }).click()
  await page.getByRole("button", { name: "লগআউট (ডেটা ফোনে থাকবে)" }).click()
  await signup("দ্বিতীয় দোকান")
  await expect(page.getByText("এই নম্বরে আগেই অ্যাকাউন্ট আছে")).toBeVisible()
})

test("লগআউটে ফোনের ডেটা মোছা: ব্যাকআপ-নিশ্চিতকরণ ছাড়া মোছা যায় না, মোছার পর স্টোরেজে দোকানের ডেটা থাকে না", async ({ page }) => {
  await mockApi(page)
  const phone = REAL ? `019${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}` : PHONE
  await page.goto("/signup/")
  const shopName = REAL ? "মোছার দোকান" : STORE.name // নকল সার্ভার সবসময় STORE.name ফেরত দেয়
  await page.locator("#storeName").fill(shopName)
  await page.getByRole("radio", { name: "কসমেটিক্স" }).click()
  await page.locator("#ownerName").fill("রহিম")
  await page.locator("#phone").fill(toBn(phone))
  await page.locator("#password").fill(PASSWORD)
  await page.getByRole("button", { name: "দোকান খুলুন" }).click()
  await expect(page.getByRole("heading", { name: shopName })).toBeVisible()

  await page.getByRole("link", { name: "প্রথম পণ্য যোগ করুন" }).click()
  await page.locator("#p-name").fill("ফেসওয়াশ")
  await page.locator("#p-cost").fill("180")
  await page.locator("#p-price").fill("240")
  await page.getByRole("button", { name: "পণ্য সেভ করুন" }).click()
  await expect(page).toHaveURL(/\/products\/detail\/\?id=/)
  const keys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pos.db.v1.") || k.startsWith("pos.device.v1.")))
  expect((await keys()).length).toBeGreaterThan(0)

  await page.goto("/settings/")
  await page.getByRole("button", { name: "লগআউট", exact: true }).click()
  await page.getByRole("button", { name: "লগআউট ও এই ফোনের ডেটা মুছুন" }).click()
  const wipe = page.getByRole("button", { name: "লগআউট করুন ও ডেটা মুছুন" })
  await expect(wipe).toBeDisabled() // ব্যাকআপ নিশ্চিত না করলে মোছা যায় না
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "আগে ব্যাকআপ নামান" }).click()])
  expect(download.suggestedFilename()).toMatch(/^pos-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await page.getByRole("checkbox").check()
  await expect(wipe).toBeEnabled()
  await wipe.click()
  await expect(page).toHaveURL(/\/login\/$/)
  expect(await keys()).toEqual([])
})
