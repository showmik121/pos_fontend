// 2FA enrollment shows a scannable QR (inline SVG, no inline styles, strict CSP) next to the manual key.
import { expect, test, type Route } from "@playwright/test"
import { adminContract } from "../src/contract/admin-api"

const URI = "otpauth://totp/Bipone%20Admin:owner%40bipone.test?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=Bipone%20Admin"

test("enrollment page shows a QR code and keeps the manual key as fallback", async ({ page }) => {
  const reply = (route: Route, id: keyof typeof adminContract, body: unknown) =>
    route.fulfill({ status: adminContract[id].status, contentType: "application/json", body: JSON.stringify(adminContract[id].response.parse(body)) })
  await page.route("**/api/v1/admin/**", async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/v1\/admin/, "")
    if (p === "/auth/login") return reply(route, "auth.login", { stage: "enroll", pendingToken: "pending-token", expiresInSeconds: 300 })
    if (p === "/auth/2fa/enroll-start") return reply(route, "auth.enroll-start", { secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", otpauthUri: URI })
    return route.fulfill({ status: 404, body: "{}" })
  })
  const csp: string[] = []
  page.on("console", (m) => { if (/content security policy/i.test(m.text())) csp.push(m.text()) })

  await page.goto("/login/")
  await page.getByLabel("Email").fill("owner@bipone.test")
  await page.getByLabel("Password").fill("correct horse battery staple")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: "Start setup" }).click()

  const qr = page.getByRole("img", { name: /QR code/i })
  await expect(qr).toBeVisible()
  const box = await qr.boundingBox()
  expect(box?.width).toBeGreaterThan(150)
  await expect(page.locator("code", { hasText: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" })).toBeVisible()
  expect(csp).toEqual([])
})
