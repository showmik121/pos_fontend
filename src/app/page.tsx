"use client"

import { tr, tf } from "@/lib/i18n"
import { AppShell, Splash } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { LinkButton } from "@/components/ui/button"
import { Card, Pill, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { HomeHeader } from "@/components/home-header"
import { Landing } from "@/components/landing/landing"
import { todayIso } from "@/lib/domain/dates"
import { formatTaka } from "@/lib/domain/money"
import { formatTimeBn, greetingBn } from "@/lib/format/datetime"
import { formatBillNo } from "@/lib/domain/bill"
import { toBanglaDigits } from "@/lib/format/bn"
import { dealerRows, payableSummary } from "@/lib/store/dealers"
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
  const payable = isOwner ? payableSummary(dealerRows(db, today)) : null
  const alerts = low > 0 || soon > 0 || dueCount > 0 || noteCount > 0 || (payable?.count ?? 0) > 0

  return (
    <AppShell title={storeName} nav hero={<HomeHeader storeName={storeName} greeting={greetingBn(new Date().getHours())} />}>
      <LinkButton href="/sell" full className="min-h-14 text-base">
        <Icon name="plus" /> {tr("নতুন বিল")}
      </LinkButton>

      <section className="hero-card rounded-3xl px-5 py-5" aria-label={tr("আজকের সারসংক্ষেপ")}>
        <div className="text-[13px] font-medium text-ink/70">{tr("আজকের বিক্রি")}</div>
        <div className="mt-0.5 text-[34px] font-extrabold leading-tight tracking-tight">{formatTaka(summary.total)}</div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1 text-[13px] font-medium text-ink">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          {toBanglaDigits(summary.bills)}{tr("টি বিল")}
        </div>
      </section>

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

      <div className={state.status === "authed" && state.user.role === "owner" ? "grid grid-cols-2 gap-3" : ""}>
        <LinkButton href="/notes" variant="secondary" full>
          {tr("নোট")}
        </LinkButton>
        {state.status === "authed" && state.user.role === "owner" ? (
          <LinkButton href="/expenses" variant="secondary" full>
            {tr("দোকানের খরচ")}
          </LinkButton>
        ) : null}
      </div>

      {isOwner ? (
        <LinkButton href="/dealers" variant="secondary" full>
          {tr("ডিলারের পাওনা")}
        </LinkButton>
      ) : null}

      <SectionTitle>{tr("নজর দিন")}</SectionTitle>
      {alerts ? (
        <RowList>
          {low > 0 ? <Row href="/stock/low" dot="danger" title={tr("স্টক কম")} subtitle={tf("{p0}টি পণ্য", { p0: (toBanglaDigits(low)) })} chevron /> : null}
          {soon > 0 ? <Row href="/stock/expiry" dot="amber" title={tr("মেয়াদ কাছে")} subtitle={tf("৩০ দিনের মধ্যে {p0}টি ব্যাচ", { p0: (toBanglaDigits(soon)) })} chevron /> : null}
          {noteCount > 0 ? <Row href="/notes" dot="amber" title={tr("আনতে হবে")} subtitle={tf("{p0}টি নোট বাকি", { p0: (toBanglaDigits(noteCount)) })} chevron /> : null}
          {payable && payable.count > 0 ? (
            <Row
              href="/dealers"
              dot={payable.overdueCount > 0 ? "danger" : "amber"}
              title={tr("ডিলারকে দিতে হবে")}
              subtitle={
                payable.overdueCount > 0
                  ? tf("{p0} জনকে {p1} · {p2} জনের সময় পেরিয়েছে", { p0: toBanglaDigits(payable.count), p1: formatTaka(payable.total), p2: toBanglaDigits(payable.overdueCount) })
                  : tf("{p0} জনকে {p1}", { p0: toBanglaDigits(payable.count), p1: formatTaka(payable.total) })
              }
              chevron
            />
          ) : null}
          {dueCount > 0 ? <Row href="/dues" dot="amber" title={tr("বাকি")} subtitle={tf("{p0} জনের কাছে {p1}", { p0: (toBanglaDigits(dueCount)), p1: (formatTaka(totalDue(db))) })} chevron /> : null}
        </RowList>
      ) : (
        <Card className="px-4 py-5 text-center text-muted">{tr("এখন সব ঠিক আছে।")}</Card>
      )}

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
