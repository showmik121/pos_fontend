import { defineConfig, devices } from "@playwright/test"

// Run `npm run build` first. The test server serves out/ with the generated CSP headers, and every API call is answered by the test itself.
const PORT = Number(process.env.E2E_PORT ?? 3220)

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, locale: "en-GB", timezoneId: "UTC", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: { command: "node e2e/serve.mjs", url: `http://localhost:${PORT}/login/`, reuseExistingServer: !process.env.CI, env: { E2E_PORT: String(PORT) } },
})
