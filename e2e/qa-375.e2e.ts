// প্রতিটি পাতা ও পর্দা ৩৭৫px-এ ঘুরে দেখা (browser-qa): উপচে পড়া, কনসোল/পাতার ত্রুটি, ভাঙা অ্যাসেট, ছোট ট্যাপ-জায়গা,
// লেবেলহীন ইনপুট, alt ছাড়া ছবি, হেডিং/ভাষা, ছোট লেখা, এবং axe-core থাকলে WCAG 2.2 AA (কনট্রাস্ট সহ)।
// কঠিন ব্যর্থতা (উপচে পড়া, ত্রুটি, ভাঙা অ্যাসেট) টেস্ট ফেল করে; বাকি পর্যবেক্ষণ রিপোর্ট ফাইলে যায়।
// রিপোর্ট ও স্ক্রিনশট: QA_OUT (ডিফল্ট test-results/qa-375)। axe: `npm i --no-save axe-core`।
import { expect, test, type Page } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { addCustomer, addToCart, completeSale, createProduct, receiveDue, removeBatch, setCartCustomer, stockIn, voidSale } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import type { Db } from "../src/lib/store/types"
import { dayOffset, mockApi, seedStore } from "./support"

const WIDTH = 375
test.use({ viewport: { width: WIDTH, height: 812 }, hasTouch: true, isMobile: true })

const OUT = process.env.QA_OUT ?? "test-results/qa-375"
const NOW = new Date()

interface Finding {
  screen: string
  overflow: string[]
  smallTargets: string[]
  unlabeled: string[]
  imgNoAlt: number
  h1: number
  lang: string
  title: string
  tinyText: number
  tinySamples: string[]
  axe: Array<{ id: string; impact: string | null | undefined; nodes: number; sample: string }>
  consoleErrors: string[]
  failedRequests: string[]
}

let axePath: string | null = null
try {
  axePath = require.resolve("axe-core/axe.min.js")
} catch {
  axePath = null // axe-core নেই: শুধু নিজস্ব পরীক্ষা
}

function fixture() {
  let db: Db = emptyDb()
  const mk = (name: string, o: { cost?: number; price?: number; open?: boolean; barcode?: string | null } = {}) => {
    const made = createProduct(db, { name, unit: "piece", cartonSize: 10, costPoisha: o.cost ?? 18000, pricePoisha: o.price ?? 24000, minStock: 5, category: "ওষুধ", barcode: o.open ? null : (o.barcode ?? name), open: o.open ?? false }, NOW)
    db = made.db
    return made.product
  }
  const stock = (id: string, qty: number, exp: string | null, no: string) => {
    db = stockIn(db, { productId: id, qty, unit: "piece", batchNo: no, expiryDate: exp, costPoisha: 18000, pricePoisha: null, requireBatchAndExpiry: false }, NOW)
  }
  const napa = mk("নাপা এক্সট্রা ৫০০ মিগ্রা ট্যাবলেট (দীর্ঘ নামের পরীক্ষা: স্কয়ার ফার্মাসিউটিক্যালস লিমিটেড)")
  stock(napa.id, 40, dayOffset(400), "N1")
  const low = mk("সেকলো ২০")
  stock(low.id, 3, dayOffset(300), "S1") // স্টক কম
  const soon = mk("ইনসুলিন")
  stock(soon.id, 6, dayOffset(20), "I1") // শিগগির মেয়াদ শেষ
  const gone = mk("পুরনো সিরাপ")
  stock(gone.id, 4, dayOffset(-5), "G1") // মেয়াদোত্তীর্ণ
  mk("খোলা পণ্য", { open: true })
  const cust = addCustomer(db, { name: "করিম উদ্দিন", phone: "01712345678" }, NOW)
  db = cust.db
  const cust2 = addCustomer(db, { name: "রহিমা বেগম", phone: "" }, NOW)
  db = cust2.db

  const sell = (productId: string, qty: number, cash: number, customerId?: string) => {
    let draft = addToCart(db.draft, productId, qty)
    if (customerId) draft = setCartCustomer(draft, customerId)
    const out = completeSale({ ...db, draft }, { cashier: "রহিম", cash, mobile: 0, mobileMethod: "bkash", devicePrefix: "A" }, NOW)
    db = out.db
    return out.sale
  }
  const cashSale = sell(napa.id, 2, 48000)
  const dueSale = sell(low.id, 1, 10000, cust.customer.id) // বাকি
  const toVoid = sell(soon.id, 1, 24000)
  db = voidSale(db, toVoid.id, { by: "রহিম", reason: "ভুল বিল" }, NOW).db
  db = receiveDue(db, cust.customer.id, 5000, "রহিম", NOW)
  db = removeBatch(db, db.batches.find((b) => b.batchNo === "G1")!.id, { by: "রহিম", reason: "মেয়াদ শেষ" }, NOW)
  stock(gone.id, 2, dayOffset(-2), "G2") // সরানোর পরেও একটি মেয়াদোত্তীর্ণ সারি দেখাতে
  return { db, napa, cashSale, dueSale, cust: cust.customer }
}

async function inspect(page: Page, screen: string, extra: Pick<Finding, "consoleErrors" | "failedRequests">): Promise<Finding> {
  const base = await page.evaluate((maxW) => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"
    }
    const label = (el: Element) => ((el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || el.getAttribute("href") || el.tagName) + "").trim().replace(/\s+/g, " ").slice(0, 40)
    // ইচ্ছাকৃত পাশে-টানা সারি (যেমন হোমের "নজর দিন" কার্ড): নিজে পর্দার ভেতরে থেকে ভেতরের জিনিস কেটে রাখে, তাই উপচে পড়া নয়
    const insideScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.getBoundingClientRect().right <= maxW + 1) return true
      }
      return false
    }
    const overflow: string[] = []
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (!vis(el)) continue
      const r = el.getBoundingClientRect()
      const fixedOrClipped = getComputedStyle(el).position === "fixed" || insideScroller(el)
      if (!fixedOrClipped && r.right > maxW + 1) overflow.push(`${el.tagName.toLowerCase()} "${label(el)}" ডান-প্রান্ত ${Math.round(r.right)}px`)
    }
    if (document.documentElement.scrollWidth > maxW) overflow.unshift(`পাতা অনুভূমিক স্ক্রলযোগ্য: scrollWidth ${document.documentElement.scrollWidth}px`)
    const small: string[] = []
    for (const el of Array.from(document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=radio],[role=checkbox]'))) {
      if (!vis(el)) continue
      const r = el.getBoundingClientRect()
      if (Math.min(r.width, r.height) < 44) small.push(`${el.tagName.toLowerCase()} "${label(el)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    const unlabeled: string[] = []
    for (const el of Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea"))) {
      if (!vis(el) && (el as HTMLInputElement).type !== "file") continue
      const i = el as HTMLInputElement
      const named = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (i.labels && i.labels.length > 0) || el.getAttribute("title")
      if (!named) unlabeled.push(`${el.tagName.toLowerCase()}#${el.id || "(id নেই)"} ${el.getAttribute("placeholder") ? "(শুধু placeholder)" : ""}`)
    }
    let tiny = 0
    const tinySamples: string[] = []
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (!vis(el) || !(el as HTMLElement).innerText || el.children.length > 0) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) {
        tiny++
        if (tinySamples.length < 6) tinySamples.push(`${size}px "${(el as HTMLElement).innerText.trim().replace(/\s+/g, " ").slice(0, 36)}"`)
      }
    }
    return {
      overflow: overflow.slice(0, 6),
      smallTargets: small.slice(0, 8),
      unlabeled,
      imgNoAlt: Array.from(document.querySelectorAll("img")).filter((i) => !i.hasAttribute("alt")).length,
      h1: document.querySelectorAll("h1").length,
      lang: document.documentElement.lang,
      title: document.title,
      tinyText: tiny,
      tinySamples,
    }
  }, WIDTH)

  let axe: Finding["axe"] = []
  if (axePath) {
    await page.addScriptTag({ path: axePath })
    axe = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (window as any).axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag22aa"] } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return r.violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: String(v.nodes[0]?.target?.[0] ?? "").slice(0, 60) }))
    })
  }
  return { screen, ...base, axe, ...extra }
}

test("৩৭৫px-এ সব পাতা ও পর্দা: উপচে পড়া, ত্রুটি, ভাঙা অ্যাসেট নেই; বাকি পর্যবেক্ষণ রিপোর্টে", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000)
  mkdirSync(OUT, { recursive: true })
  const f = fixture()
  const findings: Finding[] = []
  let consoleErrors: string[] = []
  let failedRequests: string[] = []

  const watch = (p: Page) => {
    p.on("console", (m) => {
      if (m.type() === "error" && !/\/api\/v1\//.test(m.text()) && !/Failed to load resource.*(404|net::)/.test(m.text())) consoleErrors.push(m.text().slice(0, 140))
    })
    p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 140)}`))
    p.on("requestfailed", (r) => {
      if (!/\/api\/v1\//.test(r.url())) failedRequests.push(`${r.method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")} ${r.failure()?.errorText ?? ""}`)
    })
    p.on("response", (r) => {
      if (r.status() >= 400 && !/\/api\/v1\//.test(r.url()) && !/\/(nonexistent|404)\/?$/.test(r.url())) failedRequests.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`)
    })
  }
  const visit = async (p: Page, screen: string, url: string | null, after?: () => Promise<void>) => {
    consoleErrors = []
    failedRequests = []
    if (url) await p.goto(url)
    await p.waitForLoadState("networkidle")
    if (after) await after()
    await p.screenshot({ path: path.join(OUT, `${screen.replace(/[^\p{L}\p{M}\p{N}]+/gu, "_")}.png`), fullPage: true })
    findings.push(await inspect(p, screen, { consoleErrors: [...consoleErrors], failedRequests: [...failedRequests] }))
  }

  // লগইন-না-থাকা পাতা
  const anon = await browser.newPage({ viewport: { width: WIDTH, height: 812 }, baseURL: testInfo.project.use.baseURL, hasTouch: true, isMobile: true })
  watch(anon)
  await anon.route("**/api/v1/**", (r) => r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "not_found", message: "x" } }) }))
  await visit(anon, "ল্যান্ডিং /", "/")
  await visit(anon, "লগইন /login", "/login/")
  await visit(anon, "সাইন-আপ /signup", "/signup/")
  await visit(anon, "সাইন-আপ: খালি জমা দিলে ত্রুটি", null, async () => {
    await anon.getByRole("button", { name: "দোকান খুলুন" }).click()
  })
  await visit(anon, "৪০৪ পাতা (অ্যাপের নিজের)", "/404/") // অজানা পথে e2e/serve.mjs সাদা-লেখা "not found" দেয়; আসল সাইটে Netlify এই 404.html দেখায়
  await anon.close()

  // লগইন-করা মালিক, ভরা দোকান
  await mockApi(page, { role: "owner", kind: "pharmacy" })
  await seedStore(page, { role: "owner", kind: "pharmacy", db: f.db })
  watch(page)
  const id = f.napa.id
  const screens: Array<[string, string, (() => Promise<void>)?]> = [
    ["হোম /", "/"],
    ["নতুন বিল /sell", "/sell/"],
    ["বিলে পণ্য খোঁজা", "/sell/search/"],
    ["ছাড় /sell/discount", "/sell/discount/"],
    ["পেমেন্ট /sell/pay", "/sell/pay/"],
    ["রসিদ (নগদ)", `/sell/receipt/?id=${f.cashSale.id}`],
    ["রসিদ (বাকি)", `/sell/receipt/?id=${f.dueSale.id}`],
    ["স্টক /stock", "/stock/"],
    ["স্টক কম /stock/low", "/stock/low/"],
    ["মেয়াদ /stock/expiry", "/stock/expiry/"],
    ["স্টকে জমা /stock/in", `/stock/in/?product=${id}`],
    ["নতুন পণ্য /products/new", "/products/new/"],
    ["খোলা পণ্য /products/open", "/products/open/"],
    ["CSV আমদানি /products/import", "/products/import/"],
    ["পণ্যের বিবরণ", `/products/detail/?id=${id}`],
    ["পণ্য সম্পাদনা", `/products/edit/?id=${id}`],
    ["বাকির তালিকা /dues", "/dues/"],
    ["কাস্টমারের খাতা", `/dues/customer/?id=${f.cust.id}`],
    ["রিপোর্ট /reports", "/reports/"],
    ["সর্বাধিক বিক্রি /reports/top", "/reports/top/"],
    ["সেটিংস /settings", "/settings/"],
    ["কর্মচারী /settings/staff", "/settings/staff/"],
  ]
  for (const [name, url, after] of screens) await visit(page, name, url, after)

  // পর্দার ভেতরের অবস্থা (শিট/ডায়ালগ) — ৩৭৫px-এও আঁটে কি না
  await visit(page, "সেটিংস: লগআউট শিট", "/settings/", async () => {
    await page.getByRole("button", { name: "লগআউট", exact: true }).click()
  })
  await visit(page, "সেটিংস: ডেটা-মোছার শিট", null, async () => {
    await page.getByRole("button", { name: "লগআউট ও এই ফোনের ডেটা মুছুন" }).click()
  })
  await visit(page, "রসিদ: বিল বাতিলের শিট", `/sell/receipt/?id=${f.cashSale.id}`, async () => {
    await page.getByRole("button", { name: "বিল বাতিল করুন" }).click()
  })
  await visit(page, "মেয়াদ: ব্যাচ সরানোর শিট", "/stock/expiry/", async () => {
    await page.getByRole("button", { name: "সরান" }).first().click()
  })
  await visit(page, "বিল: পূর্ণ কার্ট (দীর্ঘ নাম, ছাড়)", null, async () => {
    await page.goto("/sell/search/")
    await page.locator("#sell-search").fill("নাপা")
    await page.getByText(/নাপা এক্সট্রা/).first().click()
    await page.getByRole("button", { name: "বাড়ান" }).click()
  })

  // নিচের নেভিগেশন ক্লিক করে ঘোরা
  // (বিল-প্রবাহের পর্দায় নিচের নেভ ইচ্ছাকৃতভাবে থাকে না, তাই প্রতিবার হোম থেকে শুরু)
  for (const [label, url] of [["বিল", /\/sell\/$/], ["স্টক", /\/stock\/$/], ["বাকি", /\/dues\/$/], ["রিপোর্ট", /\/reports\/$/]] as const) {
    await page.goto("/")
    await page.getByRole("navigation").getByRole("link", { name: label }).click()
    await expect(page).toHaveURL(url)
  }

  writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 2))
  const hard = findings.flatMap((x) => [
    ...x.overflow.map((o) => `${x.screen}: উপচে পড়া — ${o}`),
    ...x.consoleErrors.map((c) => `${x.screen}: কনসোল ত্রুটি — ${c}`),
    ...x.failedRequests.map((r) => `${x.screen}: ভাঙা অনুরোধ — ${r}`),
  ])
  expect(hard, hard.join("\n")).toEqual([])
})
