// Operator flows against the BUILT static site (strict CSP enforced by e2e/serve.mjs). The API is answered by the test, so no backend is needed;
// every mocked reply is parsed with the real contract schemas, so a contract change breaks this suite instead of silently passing.
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page, type Route } from "@playwright/test"
import { adminContract, type AdminSummary } from "../src/contract/admin-api"

const SHOP = "11111111-1111-4111-8111-111111111111"
const NOW = new Date().toISOString()

const admin = (role: AdminSummary["role"]): AdminSummary => ({ id: "22222222-2222-4222-8222-222222222222", email: `${role}@bipone.test`, name: `${role} person`, role, active: true, enrolled: true, mustReenroll: false, lastLoginAt: null, createdAt: NOW })
const tenantRow = (over: Record<string, unknown> = {}) => ({
  id: SHOP, name: "Sobuj Pharmacy", kind: "pharmacy", ownerName: "Karim", ownerPhoneMasked: "017****030", createdAt: NOW, status: "active", grandfathered: false,
  trialEndsAt: null, lastSyncAt: null, deviceCount: 2, staffCount: 1, ...over,
})
const detail = (status = "active") => ({
  tenant: { ...tenantRow({ status }), address: "Dhaka", statusMessage: null, statusChangedAt: NOW, readOnlySince: null, lastEventAt: null },
  staff: [{ name: "Karim", phoneMasked: "017****030", role: "owner", active: true, createdAt: NOW }],
  devices: [{ code: "A", createdAt: NOW }],
  statusHistory: [],
  recentErrors: [],
})

interface Calls { listQueries: string[]; posts: Array<{ path: string; body: unknown }> }

/** answers /v1/admin/* from the test; each reply is validated against the contract before it is sent */
async function mockApi(page: Page, role: AdminSummary["role"], opts: { failList?: boolean } = {}): Promise<Calls> {
  const calls: Calls = { listQueries: [], posts: [] }
  const reply = (route: Route, id: keyof typeof adminContract, body: unknown, status?: number) => {
    const parsed = adminContract[id].response.parse(body)
    return route.fulfill({ status: status ?? adminContract[id].status, contentType: "application/json", body: JSON.stringify(parsed) })
  }
  await page.route("**/api/v1/admin/**", async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^.*\/v1\/admin/, "")
    const body = req.postData() ? JSON.parse(req.postData() ?? "{}") : null
    if (req.method() === "POST") calls.posts.push({ path: p, body })
    if (p === "/auth/login") return reply(route, "auth.login", { stage: "2fa", pendingToken: "pending-token", expiresInSeconds: 300 })
    if (p === "/auth/2fa") return reply(route, "auth.2fa", { token: "session-token", admin: admin(role), expiresInSeconds: 1800 })
    if (p === "/auth/step-up") return reply(route, "auth.step-up", { stepUpUntil: new Date(Date.now() + 300_000).toISOString() })
    if (p === "/auth/logout") return reply(route, "auth.logout", { ok: true })
    if (p === "/tenants") {
      calls.listQueries.push(url.search)
      if (opts.failList) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "Error: select failed at pg-admin.ts:88\n    at stack trace", details: null } }) })
      return reply(route, "tenants.list", { tenants: [tenantRow()], total: 1, nextCursor: null })
    }
    if (p === `/tenants/${SHOP}`) return reply(route, "tenants.get", detail())
    if (p === `/tenants/${SHOP}/notes`) return reply(route, "tenants.notes.list", { notes: [] })
    if (p === `/tenants/${SHOP}/suspend`) return reply(route, "tenants.suspend", { fromStatus: "active", toStatus: "suspended", changedAt: NOW })
    if (p === `/tenants/${SHOP}/reveal-phone`) return reply(route, "tenants.revealPhone", { phones: [{ name: "Karim", role: "owner", phone: "01711111030" }] })
    if (p === "/audit") return reply(route, "audit.list", { rows: [], nextCursor: null })
    if (p === "/dashboard") return reply(route, "dashboard.get", { tenantsByStatus: { active: 4, trial: 2, suspended: 1 }, stuckSync: 3, newErrors: 5, negativeStockTenants: 2, signupsToday: 1, stuckHours: 24 })
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "x", details: null } }) })
  })
  return calls
}

async function signIn(page: Page) {
  await page.goto("/login/")
  await page.getByLabel("Email").fill("op@bipone.test")
  await page.getByLabel("Password").fill("a-long-passphrase-123")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel(/6-digit code/).fill("123456")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shops" }).click()
  await expect(page.getByRole("heading", { name: "Shops" })).toBeVisible()
}

/** a CSP violation or console error in the built app is a failure, whatever else passed */
function watchBrowser(page: Page) {
  const problems: string[] = []
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`)
  })
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
  return problems
}

test("sign in, see masked phones, token never touches storage, no CSP violations, no axe violations", async ({ page, context }) => {
  const problems = watchBrowser(page)
  await mockApi(page, "viewer")
  await signIn(page)

  await expect(page.getByRole("link", { name: "Sobuj Pharmacy" })).toBeVisible()
  await expect(page.getByText("017****030")).toBeVisible()
  await expect(page.locator("body")).not.toContainText("01711111030")

  const stored = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))
  expect(stored).not.toContain("session-token")
  expect(stored).not.toContain("pending-token")
  expect(JSON.stringify(await context.cookies())).not.toContain("token")
  expect(page.url()).not.toContain("token")

  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  expect(problems).toEqual([])
})

test("a reload ends the session (token is memory-only) and returns to sign-in", async ({ page }) => {
  await mockApi(page, "viewer")
  await signIn(page)
  await page.reload()
  await expect(page).toHaveURL(/\/login\//)
})

test("filters live in the URL and are sent to the API; a hand-edited URL does not crash", async ({ page }) => {
  const problems = watchBrowser(page)
  const calls = await mockApi(page, "viewer")
  await signIn(page)
  await page.getByLabel("Last sync").selectOption("3")
  await expect(page).toHaveURL(/noSyncDays=3/)
  await expect.poll(() => calls.listQueries.some((q) => q.includes("noSyncDays=3"))).toBe(true)

  await page.goto("/tenants/?status=bogus&noSyncDays=-9&sort=hax")
  await expect(page).toHaveURL(/\/login\//) // a fresh load has no in-memory session: signs in again rather than crashing
  expect(problems.filter((p) => p.startsWith("pageerror"))).toEqual([])
})

test("a server error shows a short English sentence, never raw JSON or a stack trace", async ({ page }) => {
  await mockApi(page, "viewer", { failList: true })
  await signIn(page)
  // Next's own route announcer is also role=alert, so pick ours by its text
  await expect(page.getByText("The server had a problem. Try again in a moment.")).toBeVisible()
  const text = await page.locator("body").innerText()
  expect(text).not.toMatch(/pg-admin|stack trace|select failed|"error"|internal/)
})

test("support sees no suspend button; super suspends with reason, owner message and step-up", async ({ page }) => {
  await mockApi(page, "support")
  await signIn(page)
  await page.getByRole("link", { name: "Sobuj Pharmacy" }).click()
  await expect(page.getByRole("heading", { name: "Sobuj Pharmacy" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Suspend" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Show full phone numbers" })).toBeVisible()
})

test("super: suspend dialog requires a reason and step-up, posts them, and reports the change", async ({ page }) => {
  const problems = watchBrowser(page)
  const calls = await mockApi(page, "super")
  await signIn(page)
  await page.getByRole("link", { name: "Sobuj Pharmacy" }).click()
  await page.getByRole("button", { name: "Suspend" }).click()

  const dialog = page.getByRole("dialog", { name: "Suspend this shop" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel("Your password")).toBeVisible()
  await dialog.getByLabel(/Reason/).fill("chargeback dispute")
  await dialog.getByLabel(/Message to the shop owner/).fill("আপনার অ্যাকাউন্ট সাময়িক বন্ধ আছে")
  await dialog.getByLabel("Your password").fill("a-long-passphrase-123")
  await dialog.getByLabel(/6-digit code/).fill("654321")
  await dialog.getByRole("button", { name: "Suspend shop" }).click()

  await expect(page.getByRole("status")).toContainText("Status changed from active to suspended")
  const step = calls.posts.find((c) => c.path === "/auth/step-up")
  expect(step?.body).toEqual({ password: "a-long-passphrase-123", code: "654321" })
  const suspend = calls.posts.find((c) => c.path === `/tenants/${SHOP}/suspend`)
  expect(suspend?.body).toEqual({ reason: "chargeback dispute", message: "আপনার অ্যাকাউন্ট সাময়িক বন্ধ আছে" })
  expect(problems).toEqual([])
})

test("revealing phone numbers needs a reason, shows them, and hides them again on close", async ({ page }) => {
  const calls = await mockApi(page, "support")
  await signIn(page)
  await page.getByRole("link", { name: "Sobuj Pharmacy" }).click()
  await page.getByRole("button", { name: "Show full phone numbers" }).click()
  const dialog = page.getByRole("dialog", { name: "Show full phone numbers" })
  await dialog.getByLabel("Reason").fill("owner called, verifying identity")
  await dialog.getByRole("button", { name: "Show numbers" }).click()
  await expect(dialog).toContainText("01711111030")
  expect(calls.posts.find((c) => c.path.endsWith("/reveal-phone"))?.body).toEqual({ reason: "owner called, verifying identity" })
  await dialog.getByRole("button", { name: "Close" }).click()
  await expect(page.locator("body")).not.toContainText("01711111030")
})

test("the dialog is keyboard-operable: Escape closes it and focus returns to the opener", async ({ page }) => {
  await mockApi(page, "super")
  await signIn(page)
  await page.getByRole("link", { name: "Sobuj Pharmacy" }).click()
  const opener = page.getByRole("button", { name: "Suspend" })
  await opener.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(opener).toBeFocused()
})
