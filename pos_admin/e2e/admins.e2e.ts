// Admin-account screen against the BUILT site (strict CSP). The API is answered by the test; every reply is validated with the real contract schemas.
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page, type Route } from "@playwright/test"
import { adminContract, type AdminSummary } from "../src/contract/admin-api"

const NOW = new Date().toISOString()
const ME = "22222222-2222-4222-8222-222222222222"
const OTHER = "44444444-4444-4444-8444-444444444444"

const person = (id: string, role: AdminSummary["role"], over: Partial<AdminSummary> = {}): AdminSummary => ({
  id, email: `${role}-${id.slice(0, 4)}@bipone.test`, name: `${role} person`, role, active: true, enrolled: true, mustReenroll: false, lastLoginAt: null, createdAt: NOW, ...over,
})

interface Calls { posts: Array<{ path: string; method: string; body: Record<string, unknown> }> }

async function mockApi(page: Page, role: AdminSummary["role"], opts: { createFails?: "email_taken" } = {}): Promise<Calls> {
  const calls: Calls = { posts: [] }
  const reply = (route: Route, id: keyof typeof adminContract, body: unknown, status?: number) =>
    route.fulfill({ status: status ?? adminContract[id].status, contentType: "application/json", body: JSON.stringify(adminContract[id].response.parse(body)) })
  await page.route("**/api/v1/admin/**", async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^.*\/v1\/admin/, "")
    const body = req.postData() ? (JSON.parse(req.postData() ?? "{}") as Record<string, unknown>) : {}
    if (req.method() !== "GET") calls.posts.push({ path: p, method: req.method(), body })
    if (p === "/auth/login") return reply(route, "auth.login", { stage: "2fa", pendingToken: "pending-token", expiresInSeconds: 300 })
    if (p === "/auth/2fa") return reply(route, "auth.2fa", { token: "session-token", admin: person(ME, role), expiresInSeconds: 1800 })
    if (p === "/auth/step-up") return reply(route, "auth.step-up", { stepUpUntil: new Date(Date.now() + 300_000).toISOString() })
    if (p === "/auth/logout") return reply(route, "auth.logout", { ok: true })
    if (p === "/dashboard") return reply(route, "dashboard.get", { tenantsByStatus: {}, stuckSync: 0, newErrors: 0, negativeStockTenants: 0, signupsToday: 0, stuckHours: 24 })
    if (p === "/admins" && req.method() === "GET") return reply(route, "admins.list", { admins: [person(ME, role), person(OTHER, "support", { enrolled: false, mustReenroll: true })] })
    if (p === "/admins" && req.method() === "POST") {
      if (opts.createFails) return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: opts.createFails, message: "এই ইমেইলে আগেই অ্যাডমিন আছে", details: null } }) })
      return reply(route, "admins.create", { admin: person("55555555-5555-4555-8555-555555555555", "finance", { enrolled: false }) })
    }
    if (p === `/admins/${OTHER}` && req.method() === "PATCH") return reply(route, "admins.update", { admin: person(OTHER, "viewer") })
    if (p === `/admins/${OTHER}/reset-2fa`) return reply(route, "admins.reset2fa", { ok: true })
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

const watch = (page: Page) => {
  const problems: string[] = []
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`))
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`))
  return problems
}

test("only a super admin sees the Admins link; support does not", async ({ page }) => {
  await mockApi(page, "support")
  await signIn(page)
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admins" })).toHaveCount(0)
})

test("super lists admins, own row has no actions, and the screen has no CSP or axe problems", async ({ page }) => {
  const problems = watch(page)
  await mockApi(page, "super")
  await signIn(page)
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admins" }).click()
  await expect(page.getByRole("heading", { name: "Admins" })).toBeVisible()
  await expect(page.getByText("Must set up 2FA again")).toBeVisible()
  await expect(page.getByText("Use the create-admin CLI for your own account")).toBeVisible()
  // one actionable row (the other admin) -> exactly one set of three buttons
  await expect(page.getByRole("button", { name: "Reset 2FA" })).toHaveCount(1)
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
  expect(problems).toEqual([])
})

test("creating an admin asks for step-up once, then posts the new admin without echoing the password", async ({ page }) => {
  const calls = await mockApi(page, "super")
  await signIn(page)
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admins" }).click()
  await page.getByRole("button", { name: "Add an admin" }).click()
  const dlg = page.getByRole("dialog", { name: "Add an admin" })
  await dlg.getByLabel("Name").fill("Rina Finance")
  await dlg.getByLabel("Email").fill("rina@bipone.test")
  await dlg.getByLabel("Role").selectOption("finance")
  await dlg.getByLabel("Temporary password").fill("a-long-temp-pass-1")
  await dlg.getByLabel("Your password").fill("a-long-passphrase-123")
  await dlg.getByLabel(/6-digit code/).fill("654321")
  await dlg.getByRole("button", { name: "Create admin" }).click()
  await expect(page.getByRole("status")).toContainText("Admin created")
  const create = calls.posts.find((c) => c.path === "/admins")
  expect(create?.body).toMatchObject({ email: "rina@bipone.test", name: "Rina Finance", role: "finance" })
  expect(calls.posts.some((c) => c.path === "/auth/step-up")).toBe(true)
  // the temporary password is never shown back on the page
  await expect(page.locator("body")).not.toContainText("a-long-temp-pass-1")
})

test("a duplicate email shows a short English sentence, not the server's text", async ({ page }) => {
  await mockApi(page, "super", { createFails: "email_taken" })
  await signIn(page)
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admins" }).click()
  await page.getByRole("button", { name: "Add an admin" }).click()
  const dlg = page.getByRole("dialog", { name: "Add an admin" })
  await dlg.getByLabel("Name").fill("Dup")
  await dlg.getByLabel("Email").fill("dup@bipone.test")
  await dlg.getByLabel("Temporary password").fill("a-long-temp-pass-1")
  await dlg.getByLabel("Your password").fill("a-long-passphrase-123")
  await dlg.getByLabel(/6-digit code/).fill("654321")
  await dlg.getByRole("button", { name: "Create admin" }).click()
  await expect(dlg.getByText("An admin with this email already exists.")).toBeVisible()
  await expect(page.locator("body")).not.toContainText("আগেই")
})

test("changing a role sends only the changed state and refreshes the list", async ({ page }) => {
  const calls = await mockApi(page, "super")
  await signIn(page)
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admins" }).click()
  await page.getByRole("button", { name: "Change role" }).click()
  const dlg = page.getByRole("dialog", { name: /Change support person/ })
  await dlg.getByLabel("Role").selectOption("viewer")
  await dlg.getByLabel("Your password").fill("a-long-passphrase-123")
  await dlg.getByLabel(/6-digit code/).fill("654321")
  await dlg.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByRole("status")).toContainText("updated")
  expect(calls.posts.find((c) => c.method === "PATCH")?.body).toMatchObject({ role: "viewer", active: true })
})
