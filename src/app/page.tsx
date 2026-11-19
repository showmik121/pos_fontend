"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { useDb } from "@/components/db-provider"
import { LinkButton } from "@/components/ui/button"
import { Card, Pill, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { todayIso } from "@/lib/domain/dates"
import { formatTaka } from "@/lib/domain/money"
import { formatTimeBn } from "@/lib/format/datetime"
import { formatBillNo } from "@/lib/domain/bill"
import { toBanglaDigits } from "@/lib/format/bn"
import { daySummary, dueRows, expiringSoonCount, lowStockProducts, totalDue } from "@/lib/store/selectors"

export default function HomePage() {
  const { state } = useAuth()
  const { db } = useDb()
  const today = todayIso()
  const storeName = state.status === "authed" ? (state.store?.name ?? "হোম") : "হোম"

  const summary = daySummary(db, today)
  const low = lowStockProducts(db, today).length
  const soon = expiringSoonCount(db, today)
  const dueCount = dueRows(db).length
  const recent = [...db.sales].reverse().slice(0, 5)
  const alerts = low > 0 || soon > 0 || dueCount > 0

  return (
    <AppShell
      title={storeName}
      nav
      action={
        <Link href="/settings" aria-label="সেটিংস" className="grid size-11 place-items-center rounded-lg text-ink active:bg-canvas">
          <Icon name="sliders" size={22} />
        </Link>
      }
    >
      <LinkButton href="/sell" full className="min-h-14 text-base">
        <Icon name="plus" /> নতুন বিল
      </LinkButton>

      <section className="hero-card rounded-3xl px-5 py-5" aria-label="আজকের সারসংক্ষেপ">
        <div className="text-[13px] font-medium text-ink/70">আজকের বিক্রি</div>
        <div className="mt-0.5 text-[34px] font-extrabold leading-tight tracking-tight">{formatTaka(summary.total)}</div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1 text-[13px] font-medium text-ink">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          {toBanglaDigits(summary.bills)}টি বিল
        </div>
      </section>

      {db.products.length === 0 ? (
        <Card className="space-y-3 px-4 py-5">
          <p className="font-medium">শুরু করুন</p>
          <p className="text-sm text-muted">বিল করার আগে পণ্য যোগ করুন — একটি একটি করে, অথবা CSV ফাইল থেকে একসাথে।</p>
          <LinkButton href="/products/new">প্রথম পণ্য যোগ করুন</LinkButton>
        </Card>
      ) : null}

      <SectionTitle>নজর দিন</SectionTitle>
      {alerts ? (
        <RowList>
          {low > 0 ? <Row href="/stock/low" dot="danger" title="স্টক কম" subtitle={`${toBanglaDigits(low)}টি পণ্য`} chevron /> : null}
          {soon > 0 ? <Row href="/stock/expiry" dot="amber" title="মেয়াদ কাছে" subtitle={`৩০ দিনের মধ্যে ${toBanglaDigits(soon)}টি ব্যাচ`} chevron /> : null}
          {dueCount > 0 ? <Row href="/dues" dot="amber" title="বাকি" subtitle={`${toBanglaDigits(dueCount)} জনের কাছে ${formatTaka(totalDue(db))}`} chevron /> : null}
        </RowList>
      ) : (
        <Card className="px-4 py-5 text-center text-muted">এখন সব ঠিক আছে।</Card>
      )}

      {recent.length > 0 ? (
        <>
          <SectionTitle>সাম্প্রতিক বিল</SectionTitle>
          <RowList>
            {recent.map((s) => (
              <Row
                key={s.id}
                href={`/sell/receipt?id=${s.id}`}
                title={`বিল #${formatBillNo(s)}`}
                subtitle={`${formatTimeBn(s.at)}${s.customerName ? ` · ${s.customerName}` : ""}`}
                right={s.voided ? <Pill tone="danger">বাতিল</Pill> : <span className="font-semibold">{formatTaka(s.total)}</span>}
                chevron
              />
            ))}
          </RowList>
        </>
      ) : null}
    </AppShell>
  )
}
