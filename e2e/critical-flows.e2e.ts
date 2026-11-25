// ব্যবসার জন্য সবচেয়ে জরুরি চার পথ (মোবাইল Chromium, নকল API; আগে `NEXT_PUBLIC_API_URL=/api npm run build`):
//  ১) অফলাইনে বিক্রি → নেট এলে সিংক   ২) ব্যাকআপ → ডেটা মোছা → ফেরানো
//  ৩) কর্মচারী ক্রয়মূল্য দেখে না/বিল বাতিল করে না   ৪) মেয়াদোত্তীর্ণ ব্যাচ কখনো বিক্রি হয় না
// দোকানের ডেটা অ্যাপের নিজের অ্যাকশনে বানিয়ে localStorage-এ বসানো হয় (e2e/support.ts)।
import { expect, test, type Page } from "@playwright/test"
import { readFileSync, writeFileSync } from "node:fs"
import { addCustomer, addToCart, completeSale, createProduct, setCartCustomer, stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import type { Db, Sale } from "../src/lib/store/types"
import { PASSWORD, STORE_ID, dayOffset, dbKey, mockApi, seedStore, storedDb, storeOf, toBn, userOf, type Kind, type Role } from "./support"

const NOW = new Date()
let barcodeSeq = 8900

/** পণ্য + (ঐচ্ছিক) ব্যাচ-ভিত্তিক স্টক */
function addProduct(db: Db, name: string, o: { cost?: number; price?: number } = {}) {
  const made = createProduct(db, { name, unit: "piece", cartonSize: 10, costPoisha: o.cost ?? 18000, pricePoisha: o.price ?? 24000, minStock: 5, category: "", barcode: String(++barcodeSeq), open: false }, NOW)
  return { db: made.db, product: made.product }
}

function addStock(db: Db, productId: string, qty: number, expiryDate: string | null, batchNo = "B1", cost = 18000): Db {
  return stockIn(db, { productId, qty, unit: "piece", batchNo, expiryDate, costPoisha: cost, pricePoisha: null, requireBatchAndExpiry: false }, NOW)
}

/** `cash` না দিলে পুরো দাম নগদে; কম দিলে (কাস্টমারসহ) বাকি হয় */
function addSale(db: Db, productId: string, qty: number, price: number, customerId?: string, cash?: number): { db: Db; sale: Sale } {
  let draft = addToCart(db.draft, productId, qty)
  if (customerId) draft = setCartCustomer(draft, customerId)
  const out = completeSale({ ...db, draft }, { cashier: "রুবেল", cash: cash ?? price * qty, mobile: 0, mobileMethod: "bkash" }, NOW)
  return { db: out.db, sale: out.sale }
}

async function addToBill(page: Page, search: string, name: string) {
  await page.goto("/sell/")
  await page.getByRole("link", { name: "নাম দিয়ে খুঁজুন" }).click()
  await page.locator("#sell-search").fill(search)
  await page.getByText(name, { exact: true }).click()
  await expect(page).toHaveURL(/\/sell\/$/)
}

// ---------------------------------------------------------------------------------------------------------------------
test("অফলাইনে বিক্রি: বিল হয়, বদল জমে থাকে, নেট এলে একবারই সার্ভারে যায়", async ({ page }) => {
  let db = emptyDb()
  const made = addProduct(db, "ফেসওয়াশ")
  db = addStock(made.db, made.product.id, 10, null)
  const mock = await mockApi(page, { role: "owner", kind: "cosmetics" })
  await seedStore(page, { role: "owner", kind: "cosmetics", db })

  // অনলাইনে খুলতেই আগের ডেটা (পণ্য, স্টক) প্রথম সিংকে সার্ভারে যায়
  await page.goto("/")
  await expect.poll(() => mock.count("stock_in"), { timeout: 15_000 }).toBe(1)
  expect(mock.count("sale_completed")).toBe(0)

  // ইন্টারনেট চলে গেল: বিক্রি চলে
  mock.offline = true
  await addToBill(page, "ফেস", "ফেসওয়াশ")
  await page.getByRole("link", { name: "পেমেন্ট নিন" }).click()
  await page.getByRole("button", { name: "বিল সম্পন্ন করুন" }).click()
  await expect(page).toHaveURL(/\/sell\/receipt\/\?id=/)
  await expect(page.getByText("বিল সম্পন্ন হয়েছে।")).toBeVisible()
  await expect(page.getByText("A-১০০১").first()).toBeVisible() // ডিভাইস কোড অফলাইনেও আছে (আগে নিবন্ধিত)

  // বদল জমে আছে, সার্ভারে কিছু যায়নি, ডেটা ফোনে নিরাপদ
  await page.goto("/settings/data/")
  await expect(page.getByText(/বদল সার্ভারে পাঠানো বাকি/)).toBeVisible({ timeout: 15_000 })
  expect(mock.count("sale_completed")).toBe(0)
  expect((await storedDb(page))?.sales).toHaveLength(1)

  // নেট ফিরল: নিজে থেকেই যায়
  mock.offline = false
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect.poll(() => mock.count("sale_completed"), { timeout: 15_000 }).toBe(1)
  await expect(page.getByText(/সার্ভারে সিংক আছে/)).toBeVisible()

  // আবার সিংক চালালে দ্বিতীয়বার যায় না (ইডেমপোটেন্ট)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect(page.getByText(/সার্ভারে সিংক আছে/)).toBeVisible()
  expect(mock.count("sale_completed")).toBe(1)
  expect(new Set(mock.pushed.map((e) => e.id)).size).toBe(mock.pushed.length)
})

// ---------------------------------------------------------------------------------------------------------------------
test("ব্যাকআপ → ফোনের ডেটা মোছা → ব্যাকআপ থেকে ফেরানো; ভুল ফাইল আটকায়", async ({ page }, testInfo) => {
  let db = emptyDb()
  const made = addProduct(db, "ফেসওয়াশ")
  db = addStock(made.db, made.product.id, 10, null)
  const cust = addCustomer(db, { name: "করিম", phone: "" }, NOW)
  const sold = addSale(cust.db, made.product.id, 1, 24000, cust.customer.id, 10000) // ১০০ টাকা নগদ, বাকি ১৪০
  await mockApi(page, { role: "owner", kind: "cosmetics" })
  await seedStore(page, { role: "owner", kind: "cosmetics", db: sold.db })

  // ১) ব্যাকআপ নামানো ও ফাইল যাচাই
  await page.goto("/settings/data/")
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ব্যাকআপ ফাইল নামান" }).click()])
  const file = testInfo.outputPath("backup.json")
  await download.saveAs(file)
  const backup = JSON.parse(readFileSync(file, "utf8")) as { app: string; storeId: string; db: Db }
  expect(backup.app).toBe("pos-backup")
  expect(backup.storeId).toBe(STORE_ID)
  expect(backup.db.sales).toHaveLength(1)
  expect(backup.db.products).toHaveLength(1)

  await page.goto("/settings/")
  // ২) লগআউট ও ফোনের ডেটা মোছা (ব্যাকআপ-নিশ্চিতকরণসহ)
  await page.getByRole("button", { name: "লগআউট", exact: true }).click()
  await page.getByRole("button", { name: "লগআউট ও এই ফোনের ডেটা মুছুন" }).click()
  await page.getByRole("button", { name: "আগে ব্যাকআপ নামান" }).click()
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: "লগআউট করুন ও ডেটা মুছুন" }).click()
  await expect(page).toHaveURL(/\/login\/$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pos.")))).toEqual([])

  // ৩) আবার লগইন: ডেটা নেই
  await page.locator("#phone").fill(toBn(userOf("owner").phone))
  await page.locator("#password").fill(PASSWORD)
  await page.getByRole("button", { name: "লগইন করুন" }).click()
  await expect(page.getByRole("heading", { name: storeOf("cosmetics").name })).toBeVisible()
  await expect(page.getByText("প্রথম পণ্য যোগ করুন").first()).toBeVisible()

  // ৪) ভুল ফাইল আটকায় (অন্য দোকানের; নষ্ট), ডেটা বদলায় না
  await page.goto("/settings/data/")
  const otherStore = testInfo.outputPath("other-store.json")
  writeFileSync(otherStore, JSON.stringify({ ...backup, storeId: "99999999-9999-4999-8999-999999999999" }))
  await page.locator('input[type="file"]').setInputFiles(otherStore)
  await expect(page.getByText("এই ব্যাকআপ অন্য দোকানের")).toBeVisible()
  const broken = testInfo.outputPath("broken.json")
  writeFileSync(broken, '{"app":"pos-backup","version":1,')
  await page.locator('input[type="file"]').setInputFiles(broken)
  await expect(page.getByText("ফাইলটি পড়া যায়নি")).toBeVisible()
  await expect(page.getByRole("button", { name: "হ্যাঁ, ফেরান" })).toHaveCount(0)

  // ৫) সঠিক ব্যাকআপ ফেরানো: পণ্য, স্টক, বিল, বাকি সব ফেরে
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(page.getByText(/ব্যাকআপে আছে: পণ্য ১টি, বিল ১টি, কাস্টমার ১জন/)).toBeVisible()
  await page.getByRole("button", { name: "হ্যাঁ, ফেরান" }).click()
  await expect(page.getByText("ব্যাকআপ থেকে তথ্য ফেরানো হয়েছে।")).toBeVisible()
  const restored = await storedDb(page)
  expect(restored?.products.map((p) => p.name)).toEqual(["ফেসওয়াশ"])
  expect(restored?.sales).toHaveLength(1)
  expect(restored?.batches[0]?.qtyRemaining).toBe(9) // ১০ - ১ বিক্রি
  expect(restored?.ledger.map((l) => [l.kind, l.amount])).toEqual([["sale", 14000]]) // বাকির খাতা: ১৪০ টাকা বাকি
  await page.goto("/")
  await expect(page.getByText("বিল #১০০১")).toBeVisible()
})

// ---------------------------------------------------------------------------------------------------------------------
/** ভূমিকা-ভিত্তিক পরীক্ষার ডেটা: বিল, মেয়াদোত্তীর্ণ ব্যাচ, ক্রয়মূল্যসহ পণ্য */
function roleFixture() {
  let db = emptyDb()
  const napa = addProduct(db, "নাপা", { cost: 18000, price: 24000 })
  db = addStock(napa.db, napa.product.id, 10, dayOffset(365))
  const old = addProduct(db, "পুরনো সিরাপ", { cost: 9000, price: 12000 })
  db = addStock(old.db, old.product.id, 4, dayOffset(-5), "OLD", 9000)
  const sold = addSale(db, napa.product.id, 1, 24000)
  return { db: sold.db, saleId: sold.sale.id, productId: napa.product.id }
}

async function openAs(page: Page, role: Role) {
  const f = roleFixture()
  await mockApi(page, { role, kind: "pharmacy" as Kind })
  await seedStore(page, { role, kind: "pharmacy", db: f.db })
  return f
}

test("মালিক: বিল বাতিল, লাভের রিপোর্ট, কর্মচারী পাতা, ব্যাচ সরানো, ক্রয়মূল্য সবই পায় (তুলনার জন্য)", async ({ page }) => {
  const f = await openAs(page, "owner")
  await page.goto(`/sell/receipt/?id=${f.saleId}`)
  await expect(page.getByRole("button", { name: "বিল বাতিল করুন" })).toBeVisible()
  await page.goto("/reports/")
  await expect(page.getByText("রিপোর্ট শুধু মালিক দেখতে পারেন।")).toHaveCount(0)
  await page.goto("/settings/")
  await expect(page.getByRole("link", { name: "কর্মচারী" })).toBeVisible()
  await page.goto("/stock/expiry/")
  await expect(page.getByRole("button", { name: "সরান" })).toBeVisible()
  await page.goto(`/products/detail/?id=${f.productId}`)
  await expect(page.getByText("ক্রয়মূল্য", { exact: true })).toBeVisible()
})

test("কর্মচারী: বিল বাতিল, লাভের রিপোর্ট, কর্মচারী-ব্যবস্থাপনা ও ব্যাচ সরানো দেখে না", async ({ page }) => {
  const f = await openAs(page, "staff")
  await page.goto(`/sell/receipt/?id=${f.saleId}`)
  await expect(page.getByText("বিল সম্পন্ন হয়েছে।").or(page.getByText("বিল নং")).first()).toBeVisible() // বিলটি দেখা যায়
  await expect(page.getByRole("button", { name: "বিল বাতিল করুন" })).toHaveCount(0)

  await page.goto("/reports/")
  await expect(page.getByText("রিপোর্ট শুধু মালিক দেখতে পারেন।")).toBeVisible()
  await expect(page.getByText(/লাভ/)).toHaveCount(0)

  await page.goto("/settings/")
  await expect(page.getByRole("link", { name: "কর্মচারী" })).toHaveCount(0)
  await page.goto("/settings/staff/")
  await expect(page.getByText("এই পাতা শুধু মালিক দেখতে পারেন।")).toBeVisible()

  await page.goto("/stock/expiry/")
  await expect(page.getByText("পুরনো সিরাপ").first()).toBeVisible() // মেয়াদোত্তীর্ণ ব্যাচ দেখা যায়
  await expect(page.getByRole("button", { name: "সরান" })).toHaveCount(0) // কিন্তু সরানো যায় না
})

test("কর্মচারী ক্রয়মূল্য দেখতে পায় না", async ({ page }) => {
  // জানা ত্রুটি: এখন অ্যাপ ক্রয়মূল্য শুধু ব্যাকএন্ডের REST-এ লুকায়, ফোনের UI-তে নয়। ঠিক হলে এই চিহ্ন সরান (নইলে টেস্ট লাল হবে)।
  // `E2E_EXPECT_FIXED=1 npx playwright test` দিলে এটি সাধারণ টেস্ট হিসেবে চলে (এখনকার ফাঁকগুলো দেখতে/ঠিক হয়েছে কি না যাচাই করতে)
  test.fail(process.env.E2E_EXPECT_FIXED !== "1", "কর্মচারীর UI-তে ক্রয়মূল্য দেখা যায়: পণ্যের বিবরণ, সম্পাদনা ও স্টক-জমার ফর্ম")
  const f = await openAs(page, "staff")
  await page.goto(`/products/detail/?id=${f.productId}`)
  await expect.soft(page.getByText("ক্রয়মূল্য"), "পণ্যের বিবরণে ক্রয়মূল্য").toHaveCount(0)
  await page.goto(`/products/edit/?id=${f.productId}`)
  await expect.soft(page.locator("#p-cost"), "পণ্য-সম্পাদনায় ক্রয়মূল্য ঘর").toHaveCount(0)
  await page.goto(`/stock/in/?product=${f.productId}`)
  await expect.soft(page.locator("#si-cost"), "স্টক-জমায় ক্রয়মূল্য ঘর").toHaveCount(0)
})

// ---------------------------------------------------------------------------------------------------------------------
/** তিনটি পণ্য: শুধু-মেয়াদোত্তীর্ণ, আজ-মেয়াদ-শেষ, আর মেয়াদোত্তীর্ণ+ভালো দুই ব্যাচ */
function expiryFixture() {
  let db = emptyDb()
  const gone = addProduct(db, "ক্রিম এক্সপায়ার্ড")
  db = addStock(gone.db, gone.product.id, 10, dayOffset(-1), "E1")
  const today = addProduct(db, "ক্রিম আজকের-মেয়াদ")
  db = addStock(today.db, today.product.id, 10, dayOffset(0), "T1")
  const mixed = addProduct(db, "ক্রিম মিশ্র")
  db = addStock(mixed.db, mixed.product.id, 5, dayOffset(-30), "OLD")
  db = addStock(db, mixed.product.id, 3, dayOffset(365), "NEW")
  return { db, gone: gone.product, today: today.product, mixed: mixed.product }
}

test("মেয়াদোত্তীর্ণ ব্যাচ কখনো বিক্রি হয় না: খোঁজা, কার্ট, সরাসরি পেমেন্ট-পাতা, ভালো ব্যাচ থাকলেও", async ({ page }) => {
  const f = expiryFixture()
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: f.db })

  await test.step("খোঁজায় মেয়াদোত্তীর্ণ ও আজ-শেষ পণ্য 'স্টক নেই', ক্লিকে বিলে ওঠে না", async () => {
    await page.goto("/sell/search/")
    await page.locator("#sell-search").fill("ক্রিম")
    await expect(page.getByText("স্টক নেই")).toHaveCount(2) // এক্সপায়ার্ড ও আজ-শেষ; মিশ্রে ভালো ব্যাচ আছে
    await page.getByText("ক্রিম এক্সপায়ার্ড", { exact: true }).click()
    await page.getByText("ক্রিম আজকের-মেয়াদ", { exact: true }).click()
    await expect(page).toHaveURL(/\/sell\/search\/$/) // কোনোটিতেই বিল-পাতায় যায়নি
    await page.goto("/sell/")
    await expect(page.getByText("বিলে কোনো পণ্য নেই")).toBeVisible()
  })

  await test.step("পুরনো কার্টে মেয়াদোত্তীর্ণ পণ্য থাকলে পেমেন্ট ব্লক, সরাসরি পেমেন্ট-পাতাতেও বিল হয় না", async () => {
    const stale: Db = { ...f.db, draft: { lines: [{ productId: f.gone.id, qty: 1, discount: 0 }], bill: { type: "amount", value: 0 }, customerId: null } }
    await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [dbKey, JSON.stringify(stale)])
    await page.goto("/sell/")
    await expect(page.getByText("স্টকে আছে ০")).toBeVisible()
    await expect(page.getByRole("button", { name: "পেমেন্ট নিন" })).toBeDisabled()
    await page.goto("/sell/pay/") // কার্ট এড়িয়ে সরাসরি
    await page.getByRole("button", { name: "বিল সম্পন্ন করুন" }).click()
    await expect(page.getByText(/স্টকে মাত্র .* পিস আছে/)).toBeVisible()
    await expect(page).toHaveURL(/\/sell\/pay\/$/)
    expect((await storedDb(page))?.sales).toHaveLength(0)
  })

  await test.step("মেয়াদোত্তীর্ণ + ভালো ব্যাচ: ভালোটা থেকেই বিক্রি, ভালো ব্যাচের বেশি হয় না, পুরনো ব্যাচ অক্ষত", async () => {
    await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [dbKey, JSON.stringify(f.db)])
    await addToBill(page, "ক্রিম", "ক্রিম মিশ্র")
    await page.getByRole("button", { name: "বাড়ান" }).click()
    await page.getByRole("button", { name: "বাড়ান" }).click() // ৩ পিস = ভালো ব্যাচের সবটুকু
    await expect(page.getByRole("link", { name: "পেমেন্ট নিন" })).toBeVisible()
    await page.getByRole("button", { name: "বাড়ান" }).click() // ৪র্থ পিস: শুধু মেয়াদোত্তীর্ণ ব্যাচে আছে
    await expect(page.getByRole("button", { name: "পেমেন্ট নিন" })).toBeDisabled()
    await page.getByRole("button", { name: "কমান" }).click()
    await page.getByRole("link", { name: "পেমেন্ট নিন" }).click()
    await page.getByRole("button", { name: "বিল সম্পন্ন করুন" }).click()
    await expect(page).toHaveURL(/\/sell\/receipt\/\?id=/)

    const after = await storedDb(page)
    const batches = after!.batches.filter((b) => b.productId === f.mixed.id)
    expect(batches.find((b) => b.batchNo === "OLD")?.qtyRemaining).toBe(5) // মেয়াদোত্তীর্ণ ব্যাচ ছোঁয়া হয়নি
    expect(batches.find((b) => b.batchNo === "NEW")?.qtyRemaining).toBe(0)
    const allocated = after!.sales.flatMap((s) => s.lines.flatMap((l) => l.allocations))
    expect(allocated.every((a) => a.batchNo === "NEW")).toBe(true)
  })
})

test("ফোনের ঘড়ি পেছানো হলে মেয়াদোত্তীর্ণ ব্যাচ আবার বিক্রি-যোগ্য হয় না", async ({ page }) => {
  // জানা ফাঁক (GAP_ANALYSIS: "Clock-skew guard for expiry ❌"): অ্যাপ ফোনের ঘড়ি বিশ্বাস করে। ঘড়ি-পাহারা বসলে এই চিহ্ন সরান।
  test.fail(process.env.E2E_EXPECT_FIXED !== "1", "ঘড়ি পেছালে মেয়াদোত্তীর্ণ ব্যাচ বিক্রি-যোগ্য হয়ে যায় (ঘড়ি-পাহারা নেই)")
  const f = expiryFixture()
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: f.db, fixedNow: new Date(Date.now() - 60 * 86_400_000) })
  await page.goto("/sell/search/")
  await page.locator("#sell-search").fill("ক্রিম এক্সপায়ার্ড")
  await expect(page.getByText("স্টক নেই")).toBeVisible()
})
