"use client"

import Link from "next/link"
import { tr, tf } from "@/lib/i18n"
import { AppShell, Splash } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { LinkButton } from "@/components/ui/button"
import { Card, Pill, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { AlertCards, type AlertCard } from "@/components/home/alert-cards"
import { QuickActions, type QuickAction } from "@/components/home/quick-actions"
import { TodayCard } from "@/components/home/today-card"
import { HomeHeader } from "@/components/home-header"
import { Landing } from "@/components/landing/landing"
import { addDays, todayIso } from "@/lib/domain/dates"
import { formatTaka } from "@/lib/domain/money"
import { formatTimeBn, greetingBn } from "@/lib/format/datetime"
import { formatBillNo } from "@/lib/domain/bill"
import { toBanglaDigits } from "@/lib/format/bn"
import { dealerRows, payableSummary } from "@/lib/store/dealers"
import { dailyTotals } from "@/lib/store/home-stats"
import { pendingNoteCount } from "@/lib/store/notes"
import { duePromises, reminderText, smsHref } from "@/lib/store/dues-view"
import { daySummary, dueRows, expiringSoonCount, lowStockProducts, totalDue } from "@/lib/store/selectors"

/** লগইন না থাকলে ল্যান্ডিং, থাকলে হোম */
export default function HomePage() {
  const { state } = useAuth()
  if (state.status === "loading") return <Splash />
  if (state.status === "anon") return <Landing />
  return <Dashboard />
}

function Dashboard() {
  const { state } = useAuth()
  const { db } = useDb()
  const today = todayIso()
  const storeName = state.status === "authed" ? (state.store?.name ?? tr("হোম")) : tr("হোম")

  const summary = daySummary(db, today)
  const low = lowStockProducts(db, today).length
  const soon = expiringSoonCount(db, today)
  const dueCount = dueRows(db).length
  const recent = [...db.sales].reverse().slice(0, 5)
  const promises = duePromises(dueRows(db), today)
  const shopName = state.status === "authed" ? (state.store?.name ?? "") : ""
  const noteCount = pendingNoteCount(db)
  const isOwner = state.status === "authed" && state.user.role === "owner"
  const storeKind = state.status === "authed" ? state.store?.kind : undefined
  const payable = isOwner ? payableSummary(dealerRows(db, today)) : null
  const alertCards = buildAlertCards({ low, soon, noteCount, dueCount, dueTotal: totalDue(db), payable })
  const quickActions = buildQuickActions({ isOwner, dueCount, soon, noteCount, payableCount: payable?.count ?? 0 })
  const yesterdayTotal = daySummary(db, addDays(today, -1)).total
  const trend = dailyTotals(db, today)

  return (
    <AppShell title={storeName} nav hero={<HomeHeader storeName={storeName} greeting={greetingBn(new Date().getHours())} kind={storeKind} />}>
      <div className="flex items-center gap-2 rounded-[22px] border border-line bg-white p-2 shadow-[0_8px_22px_rgba(42,35,21,0.12)]">
        <Link href="/sell" className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1">
          <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-full bg-gold text-ink">
            <Icon name="plus" size={24} />
          </span>
          <span className="min-w-0 leading-snug">
            <span className="block text-base font-extrabold">{tr("নতুন বিল")}</span>
            <span className="block text-[12.5px] text-muted">{tr("নাম দিয়ে খুঁজুন বা স্ক্যান করুন")}</span>
          </span>
        </Link>
        <Link href="/sell?scan=1" aria-label={tr("স্ক্যান করে বিল শুরু করুন")} className="press grid size-12 flex-none place-items-center rounded-2xl bg-brand-soft text-brand-dark">
          <Icon name="scan" size={26} />
        </Link>
      </div>

      <TodayCard summary={summary} yesterdayTotal={yesterdayTotal} totals={trend} />

      {db.products.length === 0 ? (
        <Card className="space-y-3 px-4 py-5">
          <p className="font-medium">{tr("শুরু করুন")}</p>
          <p className="text-sm text-muted">{tr("বিল করার আগে পণ্য যোগ করুন — একটি একটি করে, অথবা CSV ফাইল থেকে একসাথে।")}</p>
          <LinkButton href="/products/new">{tr("প্রথম পণ্য যোগ করুন")}</LinkButton>
        </Card>
      ) : null}

      {promises.length > 0 ? (
        <>
          <SectionTitle>{tr("আজ আদায়ের কথা")}</SectionTitle>
          <RowList>
            {promises.map((p) => {
              const c = p.row.customer
              return (
                <div key={c.id} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <Row
                      href={`/dues/customer?id=${c.id}`}
                      dot={p.lateDays > 0 ? "danger" : "amber"}
                      title={c.name}
                      subtitle={`${p.lateDays > 0 ? tf("{p0} দিন পেরিয়েছে", { p0: (toBanglaDigits(p.lateDays)) }) : tr("আজ দেওয়ার কথা")}${p.note ? ` · ${p.note}` : ""}`}
                      right={<span className="font-semibold text-warn">{formatTaka(p.row.balance)}</span>}
                    />
                  </div>
                  {c.phone ? (
                    <a
                      href={smsHref(c.phone, reminderText({ customerName: c.name, balance: p.row.balance, storeName: shopName }))}
                      aria-label={tf("{p0}-কে এসএমএস পাঠান", { p0: (c.name) })}
                      className="mr-3 flex min-h-10 flex-none items-center rounded-xl border border-line-strong bg-white px-3 text-sm font-medium active:bg-canvas"
                    >
                      {tr("এসএমএস")}
                    </a>
                  ) : null}
                </div>
              )
            })}
          </RowList>
        </>
      ) : null}

      <QuickActions actions={quickActions} />

      <SectionTitle>{tr("নজর দিন")}</SectionTitle>
      {alertCards.length > 0 ? <AlertCards cards={alertCards} /> : <Card className="px-4 py-5 text-center text-muted">{tr("এখন সব ঠিক আছে।")}</Card>}

      {recent.length > 0 ? (
        <>
          <SectionTitle>{tr("সাম্প্রতিক বিল")}</SectionTitle>
          <RowList>
            {recent.map((s) => (
              <Row
                key={s.id}
                href={`/sell/receipt?id=${s.id}`}
                title={tf("বিল #{p0}", { p0: (formatBillNo(s)) })}
                subtitle={`${formatTimeBn(s.at)}${s.customerName ? ` · ${s.customerName}` : ""}`}
                right={s.voided ? <Pill tone="danger">{tr("বাতিল")}</Pill> : <span className="font-semibold">{formatTaka(s.total)}</span>}
                chevron
              />
            ))}
          </RowList>
        </>
      ) : null}
    </AppShell>
  )
}

type Payable = ReturnType<typeof payableSummary>

function buildAlertCards(x: { low: number; soon: number; noteCount: number; dueCount: number; dueTotal: number; payable: Payable | null }): AlertCard[] {
  const cards: AlertCard[] = []
  if (x.low > 0) cards.push({ key: "low", href: "/stock/low", tone: "coral", label: tr("স্টক কম"), big: tf("{p0}টি", { p0: toBanglaDigits(x.low) }), sub: tr("পণ্য শেষের পথে") })
  if (x.soon > 0) cards.push({ key: "soon", href: "/stock/expiry", tone: "gold", label: tr("মেয়াদ কাছে"), big: tf("{p0}টি", { p0: toBanglaDigits(x.soon) }), sub: tr("ব্যাচ, ৩০ দিনের মধ্যে") })
  if (x.noteCount > 0) cards.push({ key: "notes", href: "/notes", tone: "sand", label: tr("আনতে হবে"), big: tf("{p0}টি", { p0: toBanglaDigits(x.noteCount) }), sub: tr("নোট বাকি") })
  if (x.payable && x.payable.count > 0) {
    const sub = x.payable.overdueCount > 0 ? tf("{p0} জনের সময় পেরিয়েছে", { p0: toBanglaDigits(x.payable.overdueCount) }) : tf("{p0} জনকে", { p0: toBanglaDigits(x.payable.count) })
    cards.push({ key: "payable", href: "/dealers", tone: "teal", label: tr("ডিলারকে দিতে হবে"), big: formatTaka(x.payable.total), sub })
  }
  if (x.dueCount > 0) cards.push({ key: "dues", href: "/dues", tone: "plum", label: tr("বাকি"), big: formatTaka(x.dueTotal), sub: tf("{p0} জনের কাছে", { p0: toBanglaDigits(x.dueCount) }) })
  return cards
}

function buildQuickActions(x: { isOwner: boolean; dueCount: number; soon: number; noteCount: number; payableCount: number }): QuickAction[] {
  const actions: QuickAction[] = [
    { key: "product", href: "/products/new", icon: "capsule", label: tr("পণ্য যোগ") },
    { key: "stockin", href: "/stock/in", icon: "box", label: tr("স্টক জমা") },
    { key: "due", href: "/dues", icon: "banknote", label: tr("বাকি আদায়"), badge: x.dueCount > 0 ? tf("{p0} জন", { p0: toBanglaDigits(x.dueCount) }) : undefined },
    { key: "expiry", href: "/stock/expiry", icon: "calendar", label: tr("মেয়াদ"), badge: x.soon > 0 ? tf("{p0}টি", { p0: toBanglaDigits(x.soon) }) : undefined },
    { key: "notes", href: "/notes", icon: "note", label: tr("নোট"), badge: x.noteCount > 0 ? tf("{p0}টি", { p0: toBanglaDigits(x.noteCount) }) : undefined },
  ]
  if (x.isOwner) {
    actions.push({ key: "expenses", href: "/expenses", icon: "wallet", label: tr("খরচ") })
    actions.push({ key: "dealers", href: "/dealers", icon: "van", label: tr("ডিলার"), badge: x.payableCount > 0 ? tf("{p0} জন", { p0: toBanglaDigits(x.payableCount) }) : undefined })
  }
  actions.push({ key: "reports", href: "/reports", icon: "chart", label: tr("রিপোর্ট") })
  return actions
}
