// E2E সহায়ক: দোকানের সেশন ও ডেটা সরাসরি localStorage-এ বসানো (সাইন-আপ UI বারবার না চালিয়ে) এবং নেট-বন্ধ করা যায় এমন নকল API।
// ডেটা বানানো হয় অ্যাপের নিজের অ্যাকশন দিয়ে (src/lib/store/actions), তাই আসল আকারের ডেটা।
import type { Page } from "@playwright/test"
import { localDateIso } from "../src/lib/domain/dates"
import type { Db } from "../src/lib/store/types"

export type Role = "owner" | "staff"
export type Kind = "pharmacy" | "cosmetics" | "other"

export const STORE_ID = "11111111-1111-4111-8111-111111111111"
export const PASSWORD = "Sobuj#Ghar2026"
const BN = "০১২৩৪৫৬৭৮৯"
export const toBn = (v: string) => v.replace(/\d/g, (d) => BN[Number(d)] ?? d)

const USERS = {
  owner: { id: "22222222-2222-4222-8222-222222222222", storeId: STORE_ID, name: "রহিম", phone: "01712345678", role: "owner", active: true },
  staff: { id: "33333333-3333-4333-8333-333333333333", storeId: STORE_ID, name: "রুবেল", phone: "01812345678", role: "staff", active: true },
} as const

export const userOf = (role: Role) => USERS[role]
export const storeOf = (kind: Kind) => ({ id: STORE_ID, name: kind === "pharmacy" ? "সবুজ ফার্মেসি" : "সবুজ কসমেটিক্স", kind })
export const dbKey = `pos.db.v1.${STORE_ID}`

/** আজ থেকে `days` দিন আগে/পরের তারিখ (YYYY-MM-DD), অ্যাপ যে স্থানীয় সময়ে আজ ধরে সেই হিসাবে */
export const dayOffset = (days: number): string => localDateIso(new Date(Date.now() + days * 86_400_000))

export interface Mock {
  /** সার্ভারে পৌঁছানো সিংক ইভেন্ট, ক্রমে */
  pushed: Array<{ id: string; kind: string }>
  /** true হলে সব API অনুরোধ নেটওয়ার্ক-ত্রুটিতে ব্যর্থ (ইন্টারনেট নেই) */
  offline: boolean
  count(kind: string): number
}

export async function mockApi(page: Page, opts: { role: Role; kind: Kind }): Promise<Mock> {
  const mock: Mock = {
    pushed: [],
    offline: false,
    count: (kind) => mock.pushed.filter((e) => e.kind === kind).length,
  }
  await page.route("**/api/v1/**", async (route) => {
    if (mock.offline) return route.abort("internetdisconnected")
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^.*\/api/, "")
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
    const user = userOf(opts.role)
    if (req.method() === "POST" && p === "/v1/auth/login") return json(200, { token: "e2e-token", user })
    if (req.method() === "GET" && p === "/v1/me") return json(200, { user, store: storeOf(opts.kind) })
    if (req.method() === "POST" && p === "/v1/sync/register-device") return json(200, { code: "A" })
    if (req.method() === "POST" && p === "/v1/sync/push") {
      const body = req.postDataJSON() as { events: Array<{ id: string; kind: string }> }
      for (const e of body.events) if (!mock.pushed.some((x) => x.id === e.id)) mock.pushed.push({ id: e.id, kind: e.kind })
      return json(200, { accepted: body.events.map((e) => e.id) })
    }
    if (req.method() === "POST" && p === "/v1/client-errors") return json(200, { ok: true })
    if (req.method() === "GET" && p.startsWith("/v1/sync/pull")) return json(200, { events: [], lastSeq: 0, hasMore: false })
    return json(404, { error: { code: "not_found", message: "e2e: নকল সার্ভারে এই পথ নেই" } })
  })
  return mock
}

/**
 * প্রথম লোডের আগে সেশন ও দোকানের ডেটা বসায়। শুধু একবার (`__seeded` চিহ্নে), তাই মোছা/লগআউটের পরের পাতা-লোডে আবার বসে না।
 * `fixedNow` দিলে ব্রাউজারের আজকের তারিখ ওটাই হয় (ঘড়ি পেছানোর পরীক্ষার জন্য)।
 */
export async function seedStore(page: Page, o: { role: Role; kind: Kind; db: Db; fixedNow?: Date }): Promise<void> {
  const session = { token: "e2e-token", user: userOf(o.role), store: storeOf(o.kind) }
  await page.addInitScript(
    ({ session, key, db, fixed }) => {
      if (fixed !== null) {
        const RealDate = Date
        class FakeDate extends RealDate {
          constructor(...a: unknown[]) {
            // @ts-expect-error: পরীক্ষার জন্য আজকের তারিখ স্থির
            if (a.length === 0) super(fixed)
            // @ts-expect-error: স্প্রেড আর্গুমেন্ট
            else super(...a)
          }
          static override now() {
            return fixed
          }
        }
        window.Date = FakeDate as DateConstructor
      }
      if (localStorage.getItem("__seeded")) return
      localStorage.setItem("pos.session.v1", JSON.stringify(session))
      localStorage.setItem(key, db)
      localStorage.setItem("__seeded", "1")
    },
    { session, key: dbKey, db: JSON.stringify(o.db), fixed: o.fixedNow ? o.fixedNow.getTime() : null },
  )
}

/** ফোনে এখন সেভ থাকা দোকানের ডেটা (স্টোরেজ থেকে সরাসরি) */
export async function storedDb(page: Page): Promise<Db | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Db) : null
  }, dbKey)
}
