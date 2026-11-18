import { defineConfig, devices } from "@playwright/test"

// আগে `NEXT_PUBLIC_API_URL=/api npm run build` চালাতে হবে: অ্যাপ তখন একই origin-এর /api ডাকে,
// আর টেস্ট সেই অনুরোধ নিজে উত্তর দেয় (আসল সার্ভার লাগে না)।
const PORT = Number(process.env.E2E_PORT ?? 3210)

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "bn-BD",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: { command: "node e2e/serve.mjs", url: `http://localhost:${PORT}/login/`, reuseExistingServer: !process.env.CI, env: { E2E_PORT: String(PORT) } },
})
