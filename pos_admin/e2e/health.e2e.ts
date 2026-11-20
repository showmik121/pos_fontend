// A2 flows: dashboard tiles, the three Health tabs, triage. Replies are parsed with the real contract schemas before they are sent.
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page, type Route } from "@playwright/test"
import { adminContract, type AdminSummary } from "../src/contract/admin-api"

const SHOP = "11111111-1111-4111-8111-111111111111"
const FP = "0123456789abcdef0123456789abcdef"
const NOW = new Date().toISOString()
// what a hostile phone could send: it must show as text and run nothing
const HOSTILE = `<img src=x onerror="window.__pwned=1"> TypeError at #`
const HOSTILE_NOTE = `<b onclick="window.__pwned=3">careful</b>`
const HOSTILE_PATH = `/<img src=x onerror="window.__pwned=2">`

const admin = (role: AdminSummary["role"]): AdminSummary => ({ id: "22222222-2222-4222-8222-222222222222", email: `${role}@bipone.test`, name: `${role} person`, role, active: true, enrolled: true, mustReenroll: false, lastLoginAt: null, createdAt: NOW })

interface Calls { posts: Array<{ path: string; body: unknown }>; gets: string[] }

async function mockApi(page: Page, role: AdminSummary["role"], opts: { failDashboard?: boolean; denyTriage?: boolean } = {}): Promise<Calls> {
  const calls: Calls = { posts: [], gets: [] }
  const reply = (route: Route, id: keyof typeof adminContract, body: unknown) => {
    const parsed = adminContract[id].response.parse(body)
    return route.fulfill({ status: adminContract[id].status, contentType: "application/json", body: JSON.stringify(parsed) })
  }
  let errStatus: "open" | "resolved" | "ignored" = "open"
  let errNote: string | null = null
  await page.route("**/api/v1/admin/**", async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^.*\/v1\/admin/, "")
    const body = req.postData() ? JSON.parse(req.postData() ?? "{}") : null
    if (req.method() === "POST") calls.posts.push({ path: p, body })
    else calls.gets.push(p + url.search)
    if (p === "/auth/login") return reply(route, "auth.login", { stage: "2fa", pendingToken: "pending-token", expiresInSeconds: 300 })
    if (p === "/auth/2fa") return reply(route, "auth.2fa", { token: "session-token", admin: admin(role), expiresInSeconds: 1800 })
    if (p === "/auth/logout") return reply(route, "auth.logout", { ok: true })
    if (p === "/dashboard") {
      if (opts.failDashboard) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "Error: select failed at pg-admin.ts:88", details: null } }) })
      return reply(route, "dashboard.get", { tenantsByStatus: { active: 4, trial: 2, suspended: 1 }, stuckSync: 3, newErrors: 5, negativeStockTenants: 2, signupsToday: 1, stuckHours: 24 })
    }
    if (p === "/health/sync") {
      const hrs = Number(url.searchParams.get("stuckHours") ?? 24)
      return reply(route, "health.sync", { tenants: [{ id: SHOP, name: "Sobuj Pharmacy", status: "active", lastSyncAt: null, createdAt: NOW, hoursSinceSync: 30 }], total: 1, stuckHours: hrs })
    }
    if (p === "/health/errors") {
      const want = url.searchParams.get("status") ?? "open"
      const rows = want === "all" || want === errStatus ? [{ fingerprint: FP, kind: "error", message: HOSTILE, path: HOSTILE_PATH, appVersion: "abc1234", count: 12, firstAt: NOW, lastAt: NOW, firstStoreId: SHOP, status: errStatus, note: errStatus === "open" ? HOSTILE_NOTE : errNote }] : []
      return reply(route, "health.errors", { errors: rows })
    }
    if (p === `/health/errors/${FP}/triage`) {
      if (opts.denyTriage) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "forbidden", message: "nope", details: null } }) })
      const b = body as { status: typeof errStatus; note?: string }
      errStatus = b.status
      errNote = b.note ?? null
      return reply(route, "health.errors.triage", { fingerprint: FP, status: errStatus, note: errNote, updatedAt: NOW })
    }
    if (p === "/health/negative-stock") return reply(route, "health.negativeStock", { tenants: [{ id: SHOP, name: "Sobuj Pharmacy", status: "active", batches: 3, unitsShort: 17 }], total: 1 })
    if (p === "/tenants") return reply(route, "tenants.list", { tenants: [], total: 0, nextCursor: null })
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
}

function watchBrowser(page: Page) {
  const problems: string[] = []
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`)
  })
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
  return problems
}

test("sign-in lands on the dashboard; tiles show counts and link to filtered lists; no axe or CSP problems", async ({ page }) => {
  const problems = watchBrowser(page)
  await mockApi(page, "viewer")
  await signIn(page)
  await expect(page.getByRole("link", { name: /Stuck sync/ })).toContainText("3")
  await expect(page.getByRole("link", { name: /New app errors/ })).toContainText("5")
  await expect(page.getByRole("link", { name: /Suspended/ })).toHaveAttribute("href", "/tenants/?status=suspended")
  await expect(page.getByRole("link", { name: /Negative stock/ })).toHaveAttribute("href", "/health/?tab=negative")
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  expect(problems).toEqual([])
})

test("a dashboard failure shows one short sentence, never raw server text", async ({ page }) => {
  await mockApi(page, "viewer", { failDashboard: true })
  await signIn(page)
  await expect(page.getByText("The server had a problem. Try again in a moment.")).toBeVisible()
  expect(await page.locator("body").innerText()).not.toMatch(/pg-admin|select failed/)
})

test("stuck-sync tab sends the chosen window and shows hours since sync", async ({ page }) => {
  const calls = await mockApi(page, "viewer")
  await signIn(page)
  await page.getByRole("link", { name: /Stuck sync/ }).click()
  await expect(page.getByRole("heading", { name: "Health" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "1 day 6 h" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Never synced" })).toBeVisible()
  await page.getByLabel("Stuck after").selectOption("168")
  await expect.poll(() => calls.gets.some((g) => g.includes("stuckHours=168"))).toBe(true)
  await expect(page.getByText(/no sync for 7 days or more/)).toBeVisible()
})

test("negative-stock tab shows counts only", async ({ page }) => {
  await mockApi(page, "viewer")
  await signIn(page)
  await page.getByRole("link", { name: /Negative stock/ }).click()
  await expect(page.getByRole("cell", { name: "17" })).toBeVisible()
  await expect(page.getByText("Counts only. Product names and prices stay in the shop.")).toBeVisible()
})

test("crash text renders as plain text and runs nothing; viewer has no triage button", async ({ page }) => {
  const problems = watchBrowser(page)
  await mockApi(page, "viewer")
  await signIn(page)
  await page.getByRole("link", { name: /New app errors/ }).click()
  await expect(page.getByText(HOSTILE, { exact: false })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  expect(await page.locator("table img").count()).toBe(0)
  await expect(page.getByText(HOSTILE_PATH, { exact: false })).toBeVisible()
  await expect(page.getByText(HOSTILE_NOTE, { exact: false })).toBeVisible()
  await expect(page.getByRole("button", { name: "Triage" })).toHaveCount(0)
  expect(problems).toEqual([])
})

test("support: the triage dialog shows crash text as text, has no axe problems, and a 403 shows one short sentence", async ({ page }) => {
  await mockApi(page, "support", { denyTriage: true })
  await signIn(page)
  await page.getByRole("link", { name: /New app errors/ }).click()
  await page.getByRole("button", { name: "Triage" }).click()
  const dialog = page.getByRole("dialog", { name: "Triage this error" })
  await expect(dialog).toBeVisible()
  expect(await dialog.locator("img").count()).toBe(0)
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  await dialog.getByRole("button", { name: "Save decision" }).click()
  await expect(dialog.getByText("Your role is not allowed to do this.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await page.getByRole("button", { name: "Triage" }).click()
  await expect(page.getByRole("dialog").getByText("Your role is not allowed to do this.")).toHaveCount(0)
})

test("axe is clean on all three Health tabs", async ({ page }) => {
  await mockApi(page, "viewer")
  await signIn(page)
  for (const tab of ["sync", "errors", "negative"]) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Health" }).click()
    await page.getByRole("navigation", { name: "Health sections" }).locator(`a[href$="tab=${tab}"]`).click()
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`))
    await expect(page.getByText("Loading…")).toHaveCount(0)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations.map((v) => `${tab} ${v.id}: ${v.nodes.length}`)).toEqual([])
  }
})

test("support triages an error: note is sent, the row leaves the open list, and the fingerprint is in the path", async ({ page }) => {
  const problems = watchBrowser(page)
  const calls = await mockApi(page, "support")
  await signIn(page)
  await page.getByRole("link", { name: /New app errors/ }).click()
  await page.getByRole("button", { name: "Triage" }).click()
  const dialog = page.getByRole("dialog", { name: "Triage this error" })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Decision").selectOption("ignored")
  await dialog.getByLabel(/Note/).fill("old build, fixed in next release")
  await dialog.getByRole("button", { name: "Save decision" }).click()
  await expect(page.getByRole("status")).toContainText("Marked as ignored")
  expect(calls.posts.find((c) => c.path === `/health/errors/${FP}/triage`)?.body).toEqual({ status: "ignored", note: "old build, fixed in next release" })
  await expect(page.getByText("No errors here.")).toBeVisible()
  await page.getByLabel("Show").selectOption("ignored")
  await expect(page.getByText("Note: old build, fixed in next release")).toBeVisible()
  expect(problems).toEqual([])
})

test("an empty note is left out of the request (the server clears the old note)", async ({ page }) => {
  const calls = await mockApi(page, "support")
  await signIn(page)
  await page.getByRole("link", { name: /New app errors/ }).click()
  await page.getByRole("button", { name: "Triage" }).click()
  const dialog = page.getByRole("dialog", { name: "Triage this error" })
  await dialog.getByLabel(/Note/).fill("")
  await dialog.getByRole("button", { name: "Save decision" }).click()
  await expect(page.getByRole("status")).toContainText("Marked as resolved")
  expect(calls.posts.find((c) => c.path === `/health/errors/${FP}/triage`)?.body).toEqual({ status: "resolved" })
})

test("the Health tabs are real links and the current one is marked (junk ?tab= fallback is unit-tested)", async ({ page }) => {
  await mockApi(page, "viewer")
  await signIn(page)
  await page.getByRole("link", { name: /Stuck sync/ }).click()
  await page.getByRole("link", { name: "App errors" }).click()
  await expect(page).toHaveURL(/tab=errors/)
  await expect(page.getByRole("link", { name: "App errors" })).toHaveAttribute("aria-current", "page")
})
