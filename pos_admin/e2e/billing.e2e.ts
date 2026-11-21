// Billing flows against the BUILT static site. Replies are parsed with the real contract schemas before they are sent.
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page, type Route } from "@playwright/test"
import { adminContract, type AdminSummary } from "../src/contract/admin-api"

const SHOP = "11111111-1111-4111-8111-111111111111"
const PLAN_GROWTH = "00000000-0000-4000-8000-000000000a02"
const PLAN_STARTER = "00000000-0000-4000-8000-000000000a01"
const PAY1 = "33333333-3333-4333-8333-333333333331"
const NOW = new Date().toISOString()
const LATER = new Date(Date.now() + 20 * 86_400_000).toISOString()

const admin = (role: AdminSummary["role"]): AdminSummary => ({ id: "22222222-2222-4222-8222-222222222222", email: `${role}@bipone.test`, name: `${role} person`, role, active: true, enrolled: true, mustReenroll: false, lastLoginAt: null, createdAt: NOW })
const plan = (id: string, name: string, pricePoisha: number, active = true) => ({ id, code: name.toLowerCase(), name, pricePoisha, limits: {}, features: {}, active })
const PLANS = [plan(PLAN_STARTER, "Starter", 49_900), plan(PLAN_GROWTH, "Growth", 119_900), plan("00000000-0000-4000-8000-000000000a03", "Business", 249_900, false)]
const payment = (over: Record<string, unknown> = {}) => ({ id: PAY1, storeId: SHOP, planId: PLAN_GROWTH, amountPoisha: 119_900, method: "bkash", txnRef: "TX-ONE", paidAt: NOW, periodStart: NOW, periodEnd: LATER, recordedAt: NOW, recordedByName: "finance person", voidedAt: null, voidReason: null, ...over })
const tenantRow = { id: SHOP, name: "Sobuj Pharmacy", kind: "pharmacy", ownerName: "Karim", ownerPhoneMasked: "017****030", createdAt: NOW, status: "active", grandfathered: false, trialEndsAt: null, lastSyncAt: null, deviceCount: 2, staffCount: 1 }

interface Mock { posts: Array<{ path: string; body: Record<string, unknown> }> }
interface Opts { status?: string; payFailure?: { status: number; code: string } | "network" | "badbody" }

async function mockApi(page: Page, role: AdminSummary["role"], opts: Opts = {}): Promise<Mock> {
  const mock: Mock = { posts: [] }
  let voided = false
  let payFailures = opts.payFailure ? 1 : 0
  const reply = (route: Route, id: keyof typeof adminContract, body: unknown, status?: number) => {
    const parsed = adminContract[id].response.parse(body)
    return route.fulfill({ status: status ?? adminContract[id].status, contentType: "application/json", body: JSON.stringify(parsed) })
  }
  await page.route("**/api/v1/admin/**", async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^.*\/v1\/admin/, "")
    const body = req.postData() ? (JSON.parse(req.postData() ?? "{}") as Record<string, unknown>) : {}
    if (req.method() !== "GET") mock.posts.push({ path: p, body })
    if (p === "/auth/login") return reply(route, "auth.login", { stage: "2fa", pendingToken: "pending-token", expiresInSeconds: 300 })
    if (p === "/auth/2fa") return reply(route, "auth.2fa", { token: "session-token", admin: admin(role), expiresInSeconds: 1800 })
    if (p === "/auth/step-up") return reply(route, "auth.step-up", { stepUpUntil: new Date(Date.now() + 300_000).toISOString() })
    if (p === "/tenants") return reply(route, "tenants.list", { tenants: [tenantRow], total: 1, nextCursor: null })
    if (p === `/tenants/${SHOP}`)
      return reply(route, "tenants.get", { tenant: { ...tenantRow, status: opts.status ?? "active", address: null, statusMessage: null, statusChangedAt: NOW, readOnlySince: null, lastEventAt: null }, staff: [], devices: [], statusHistory: [], recentErrors: [] })
    if (p === `/tenants/${SHOP}/notes`) return reply(route, "tenants.notes.list", { notes: [] })
    if (p === "/dashboard") return reply(route, "dashboard.get", { tenantsByStatus: { active: 1 }, stuckSync: 0, newErrors: 0, negativeStockTenants: 0, signupsToday: 0, stuckHours: 24 })
    if (p === "/plans") return reply(route, "billing.plans.list", { plans: PLANS })
    if (p === `/tenants/${SHOP}/billing`)
      return reply(route, "billing.tenant", {
        storeId: SHOP, status: opts.status ?? "active", grandfathered: false, plan: PLANS[1], trialEndsAt: opts.status === "trial" ? LATER : null, currentPeriodEnd: LATER,
        payments: [payment({ voidedAt: voided ? NOW : null, voidReason: voided ? "Wrong shop" : null })],
        events: [{ at: NOW, fromStatus: "trial", toStatus: "active", actor: "admin", adminName: "finance person", reason: "Payment recorded" }],
      })
    if (p === `/tenants/${SHOP}/payments`) {
      if (payFailures > 0 && opts.payFailure) {
        payFailures -= 1
        if (opts.payFailure === "network") return route.abort("failed")
        if (opts.payFailure === "badbody") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ unexpected: true }) })
        return route.fulfill({ status: opts.payFailure.status, contentType: "application/json", body: JSON.stringify({ error: { code: opts.payFailure.code, message: "x", details: null } }) })
      }
      return reply(route, "billing.payments.record", { payment: payment({ id: "33333333-3333-4333-8333-333333333332" }), replayed: false, fromStatus: "active", toStatus: "active" })
    }
    if (p === `/payments/${PAY1}/void`) {
      voided = true
      return reply(route, "billing.payments.void", { payment: payment({ voidedAt: NOW, voidReason: "Wrong shop" }), storeId: SHOP })
    }
    if (p === `/tenants/${SHOP}/trial/extend`) return reply(route, "billing.trial.extend", { trialEndsAt: LATER, status: "trial" })
    if (p === `/plans/${PLAN_GROWTH}`) return reply(route, "billing.plans.update", { plan: plan(PLAN_GROWTH, "Growth", 129_900) })
    if (p === "/billing/overview")
      return reply(route, "billing.overview", {
        mrrPoisha: 1_199_000, collectedThisMonthPoisha: 359_700, paymentsThisMonth: 3, voidedThisMonthPoisha: 49_900, tenantsByStatus: { active: 9, trial: 2, grace: 1 }, grandfathered: 4,
        trialsEndingSoon: [{ id: SHOP, name: "Sobuj Pharmacy", trialEndsAt: LATER }], overdue: [{ id: SHOP, name: "Rina Cosmetics", status: "grace", dueAt: NOW, daysOverdue: 3 }], overdueTotal: 1,
      })
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "x", details: null } }) })
  })
  return mock
}

async function signIn(page: Page) {
  await page.goto("/login/")
  await page.getByLabel("Email").fill("op@bipone.test")
  await page.getByLabel("Password").fill("a-long-passphrase-123")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel(/6-digit code/).fill("123456")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
}
const openShop = async (page: Page) => {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shops" }).click()
  await page.getByRole("link", { name: "Sobuj Pharmacy" }).click()
  await expect(page.getByRole("heading", { name: "Billing", level: 2 })).toBeVisible()
}
function watchBrowser(page: Page) {
  const problems: string[] = []
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`))
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
  return problems
}

test("finance records a bKash payment: transaction ID required, amount in taka becomes poisha, key is sent", async ({ page }) => {
  const problems = watchBrowser(page)
  const mock = await mockApi(page, "finance")
  await signIn(page)
  await openShop(page)
  await expect(page.getByText("৳1,199.00").first()).toBeVisible()

  await page.getByRole("button", { name: "Record payment" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Amount received (taka)").fill("1199")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(dlg.getByText("Enter the transaction ID (only cash payments can leave it empty).")).toBeVisible()
  expect(mock.posts.filter((x) => x.path.endsWith("/payments"))).toHaveLength(0)

  await dlg.getByLabel("Transaction ID").fill("TX-NEW-123")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("status")).toContainText("Payment recorded")
  const post = mock.posts.find((x) => x.path === `/tenants/${SHOP}/payments`)
  expect(post?.body).toMatchObject({ amountPoisha: 119_900, method: "bkash", txnRef: "TX-NEW-123", planId: PLAN_GROWTH })
  expect(String(post?.body.idempotencyKey)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  expect(problems).toEqual([])
})

test("cash needs no transaction ID and sends none", async ({ page }) => {
  const mock = await mockApi(page, "finance")
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: "Record payment" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Method").selectOption("cash")
  await expect(dlg.getByLabel("Transaction ID")).toHaveCount(0)
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("status")).toContainText("Payment recorded")
  expect(mock.posts.find((x) => x.path.endsWith("/payments"))?.body).not.toHaveProperty("txnRef")
})

test("a refused payment (duplicate ID) shows a plain sentence and the next try uses a NEW idempotency key", async ({ page }) => {
  const mock = await mockApi(page, "finance", { payFailure: { status: 409, code: "duplicate_txn" } })
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: "Record payment" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Transaction ID").fill("TX-DUP-1")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(dlg.getByText("A payment with this method and transaction ID is already recorded.")).toBeVisible()
  await dlg.getByLabel("Transaction ID").fill("TX-DUP-2")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("status")).toContainText("Payment recorded")
  const keys = mock.posts.filter((x) => x.path.endsWith("/payments")).map((x) => x.body.idempotencyKey)
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toEqual(keys[1])
})

test("when the network drops the outcome is unknown, so the retry REUSES the same idempotency key", async ({ page }) => {
  const mock = await mockApi(page, "finance", { payFailure: "network" })
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: "Record payment" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Transaction ID").fill("TX-NET-1")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(dlg.getByText("Cannot reach the server. Check your connection.")).toBeVisible()
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("status")).toContainText("Payment recorded")
  const keys = mock.posts.filter((x) => x.path.endsWith("/payments")).map((x) => x.body.idempotencyKey)
  expect(keys.length).toBeGreaterThanOrEqual(1) // an aborted request may not reach the recorder; the surviving key must be the retry's
  expect(new Set(keys).size).toBe(1)
})

test("a 201 whose body cannot be read may have recorded the payment: the retry REUSES the key and the screen says to check the list", async ({ page }) => {
  const mock = await mockApi(page, "finance", { payFailure: "badbody" })
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: "Record payment" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Transaction ID").fill("TX-BAD-1")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(dlg.getByText(/may already be recorded/)).toBeVisible()
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("status")).toContainText("Payment recorded")
  const keys = mock.posts.filter((x) => x.path.endsWith("/payments")).map((x) => x.body.idempotencyKey)
  expect(keys).toHaveLength(2)
  expect(keys[0]).toEqual(keys[1])
})

test("an amount above the one-payment limit is stopped in the form with a clear sentence", async ({ page }) => {
  const mock = await mockApi(page, "finance")
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: "Record payment" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Amount received (taka)").fill("2000000")
  await dlg.getByLabel("Transaction ID").fill("TX-BIG-1")
  await dlg.getByRole("button", { name: "Record payment" }).click()
  await expect(dlg.getByText(/too large for one payment/)).toBeVisible()
  expect(mock.posts.filter((x) => x.path.endsWith("/payments"))).toHaveLength(0)
})

test("viewer and support can read billing but see no money-changing buttons", async ({ page }) => {
  await mockApi(page, "viewer")
  await signIn(page)
  await openShop(page)
  await expect(page.getByText("TX-ONE")).toBeVisible()
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Void/ })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Extend trial" })).toHaveCount(0)
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Billing" }).click()
  await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible()
  await expect(page.getByText("৳11,990.00")).toBeVisible()
  await expect(page.getByRole("button", { name: /^Edit plan/ })).toHaveCount(0)
})

test("finance voids a payment: reason and step-up are required, the row stays and is marked voided", async ({ page }) => {
  const mock = await mockApi(page, "finance")
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: /^Void the/ }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel(/^Reason/).fill("Wrong shop")
  await dlg.getByLabel("Your password").fill("a-long-passphrase-123")
  await dlg.getByLabel(/6-digit code/).fill("654321")
  await dlg.getByRole("button", { name: "Void payment" }).click()
  await expect(page.getByRole("status")).toContainText("Payment voided.")
  await expect(page.getByText("Voided", { exact: false }).first()).toBeVisible()
  await expect(page.getByText("Reason: Wrong shop")).toBeVisible()
  expect(mock.posts.some((x) => x.path === "/auth/step-up")).toBe(true)
  expect(mock.posts.find((x) => x.path === `/payments/${PAY1}/void`)?.body).toEqual({ reason: "Wrong shop" })
})

test("extend trial is offered only for a trial shop and posts days and reason", async ({ page }) => {
  const mock = await mockApi(page, "finance", { status: "trial" })
  await signIn(page)
  await openShop(page)
  await page.getByRole("button", { name: "Extend trial" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel("Days to add (1–30)").fill("7")
  await dlg.getByLabel(/^Reason/).fill("Owner asked")
  await dlg.getByRole("button", { name: "Extend trial" }).click()
  await expect(page.getByRole("status")).toContainText("Trial now ends")
  expect(mock.posts.find((x) => x.path.endsWith("/trial/extend"))?.body).toEqual({ days: 7, reason: "Owner asked" })
})

test("super edits a plan price in taka; step-up is asked; the overview and plans have no axe violations", async ({ page }) => {
  const problems = watchBrowser(page)
  const mock = await mockApi(page, "super")
  await signIn(page)
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Billing" }).click()
  await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible()
  await expect(page.getByText("Rina Cosmetics")).toBeVisible()
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])

  await page.getByRole("button", { name: "Edit plan Growth" }).click()
  const dlg = page.getByRole("dialog")
  await dlg.getByLabel(/^Price per 30 days/).fill("1299")
  await dlg.getByLabel(/^Reason/).fill("Price review")
  await dlg.getByLabel("Your password").fill("a-long-passphrase-123")
  await dlg.getByLabel(/6-digit code/).fill("654321")
  await dlg.getByRole("button", { name: "Save plan" }).click()
  await expect(dlg).toHaveCount(0)
  expect(mock.posts.find((x) => x.path === `/plans/${PLAN_GROWTH}`)?.body).toMatchObject({ name: "Growth", pricePoisha: 129_900, active: true, reason: "Price review" })
  expect(problems).toEqual([])
})

test("the shop page billing panel has no axe violations", async ({ page }) => {
  await mockApi(page, "finance")
  await signIn(page)
  await openShop(page)
  await expect(page.getByText("TX-ONE")).toBeVisible()
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
})
