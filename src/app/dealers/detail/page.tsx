"use client"

import { tr, tf } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AppShell, Splash } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, Row, RowList, SectionTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Sheet } from "@/components/ui/sheet"
import { formatDayMonthBn, todayIso } from "@/lib/domain/dates"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka, parseTaka, takaInputValue } from "@/lib/domain/money"
import { formatPhoneBn } from "@/lib/format/phone"
import { useSessionInfo } from "@/lib/hooks/use-session"
import {
  addDealerEntry,
  DEALER_NAME_MAX,
  DEALER_NOTE_MAX,
  dealerEntries,
  dealerStatus,
  findDealer,
  removeDealer,
  removeDealerEntry,
  runningBalances,
  updateDealer,
  updateDealerEntry,
} from "@/lib/store/dealers"
import type { DealerEntry } from "@/lib/store/types"

interface EntryForm {
  /** বদলের সময় লেনদেনের id */
  id: string | null
  kind: DealerEntry["kind"]
  amount: string
  date: string
  dueDate: string
  note: string
}

const blankForm = (kind: DealerEntry["kind"]): EntryForm => ({ id: null, kind, amount: "", date: todayIso(), dueDate: "", note: "" })

function DealerDetail() {
  const id = useSearchParams().get("id")
  const router = useRouter()
  const { db, update } = useDb()
  const { actor, isOwner } = useSessionInfo()
  const [form, setForm] = useState<EntryForm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const dealer = id ? findDealer(db, id) : undefined
  if (!isOwner) {
    return (
      <AppShell title={tr("ডিলার")} backHref="/">
        <Banner tone="warn">{tr("ডিলারের হিসাব শুধু মালিক দেখতে ও লিখতে পারেন।")}</Banner>
      </AppShell>
    )
  }
  if (!dealer) {
    return (
      <AppShell title={tr("ডিলার")} backHref="/dealers">
        <Banner tone="warn">{tr("ডিলার পাওয়া যায়নি।")}</Banner>
      </AppShell>
    )
  }

  const today = todayIso()
  const status = dealerStatus(db, dealer.id, today)
  const entries = dealerEntries(db, dealer.id)
  const running = runningBalances(entries)
  const list = [...entries].reverse()

  const openNew = (kind: DealerEntry["kind"]) => {
    setError(null)
    setForm(blankForm(kind))
  }
  const openEdit = (x: DealerEntry) => {
    setError(null)
    setForm({ id: x.id, kind: x.kind, amount: takaInputValue(x.amount), date: x.date, dueDate: x.dueDate ?? "", note: x.note })
  }

  const save = () => {
    if (!form) return
    setError(null)
    const poisha = parseTaka(form.amount)
    if (poisha == null || poisha <= 0) return setError(tr("টাকার পরিমাণ সঠিকভাবে দিন"))
    const input = { kind: form.kind, amount: poisha, date: form.date, dueDate: form.kind === "purchase" ? form.dueDate : "", note: form.note }
    try {
      update((d) => (form.id ? updateDealerEntry(d, form.id, input, new Date()) : addDealerEntry(d, dealer.id, input, actor, new Date())))
      setForm(null)
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  const removeEntry = () => {
    if (!form?.id) return
    const entryId = form.id
    update((d) => removeDealerEntry(d, entryId))
    setForm(null)
  }

  const saveDealer = () => {
    setEditError(null)
    try {
      update((d) => updateDealer(d, dealer.id, { name: editName, phone: editPhone }))
      setEditing(false)
    } catch (err) {
      setEditError(domainMessage(err))
    }
  }

  const deleteDealer = () => {
    setEditError(null)
    try {
      update((d) => removeDealer(d, dealer.id))
      router.replace("/dealers")
    } catch (err) {
      setEditError(domainMessage(err))
    }
  }

  return (
    <AppShell
      title={dealer.name}
      backHref="/dealers"
      action={
        <Button variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => { setEditError(null); setEditName(dealer.name); setEditPhone(dealer.phone); setEditing(true) }}>
          {tr("বদল")}
        </Button>
      }
    >
      <Card className="px-4 py-3">
        <div className="text-sm text-muted">{status.balance < 0 ? tr("অগ্রিম দেওয়া আছে") : tr("ডিলারকে দিতে হবে")}</div>
        <div className={status.balance > 0 ? "text-[28px] font-bold leading-tight text-warn" : "text-[28px] font-bold leading-tight"}>{formatTaka(Math.abs(status.balance))}</div>
        {status.balance > 0 && status.nextDue ? (
          <div className={status.overdue ? "text-sm font-medium text-danger" : "text-sm text-muted"}>
            {status.overdue ? tf("শোধের তারিখ পেরিয়েছে ({p0})", { p0: formatDayMonthBn(status.nextDue) }) : tf("শোধ দিতে হবে {p0}", { p0: formatDayMonthBn(status.nextDue) })}
          </div>
        ) : null}
        {dealer.phone ? <div className="text-sm text-muted">{formatPhoneBn(dealer.phone)}</div> : null}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => openNew("purchase")}>{tr("বাকিতে মাল নিলাম")}</Button>
        <Button variant="secondary" onClick={() => openNew("payment")}>
          {tr("টাকা দিলাম")}
        </Button>
      </div>
      {dealer.phone ? (
        <a href={`tel:${dealer.phone}`} className="flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-white font-medium active:bg-canvas">
          {tr("কল করুন")}
        </a>
      ) : null}

      <SectionTitle>{tr("লেনদেনের খাতা")}</SectionTitle>
      {list.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("এখনো কোনো লেনদেন নেই।")}</Card>
      ) : (
        <RowList>
          {list.map((x) => {
            const after = running.get(x.id) ?? 0
            return (
              <Row
                key={x.id}
                onClick={() => openEdit(x)}
                dot={x.kind === "purchase" ? "amber" : "brand"}
                title={x.kind === "purchase" ? tr("মাল নিয়েছি (বাকি)") : tr("টাকা দিয়েছি")}
                subtitle={`${formatDayMonthBn(x.date)}${x.note ? ` · ${x.note}` : ""}${x.dueDate ? tf(" · শোধ {p0}", { p0: formatDayMonthBn(x.dueDate) }) : ""} · ${tf("পাওনা {p0}", { p0: formatTaka(after) })}`}
                right={<span className={x.kind === "purchase" ? "font-semibold text-warn" : "font-semibold text-brand-dark"}>{`${x.kind === "purchase" ? "+" : "−"}${formatTaka(x.amount)}`}</span>}
                tall
              />
            )
          })}
        </RowList>
      )}
      <p className="text-center text-sm text-muted">{tr("লেনদেন চাপলে বদল বা মোছা যাবে।")}</p>

      <Sheet open={form !== null} onClose={() => setForm(null)} label={form?.kind === "payment" ? tr("টাকা দিলাম") : tr("বাকিতে মাল নিলাম")}>
        {form ? (
          <>
            <h2 className="text-lg font-bold">
              {dealer.name} — {form.kind === "payment" ? tr("টাকা দিলাম") : tr("বাকিতে মাল নিলাম")}
            </h2>
            <Field id="de-amount" label={form.kind === "payment" ? tr("কত টাকা দিলেন") : tr("মালের মোট দাম (বাকি)")} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
            <Field id="de-date" label={tr("তারিখ")} type="date" max={todayIso()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            {form.kind === "purchase" ? <Field id="de-due" label={tr("কবে টাকা দিতে হবে (ইচ্ছা হলে)")} type="date" min={form.date} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /> : null}
            <Field id="de-note" label={tr("নোট (ইচ্ছা হলে)")} placeholder={form.kind === "purchase" ? tr("যেমন: চালান নং ১২৩") : tr("যেমন: বিকাশে দিলাম")} maxLength={DEALER_NOTE_MAX} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Button full onClick={save}>
              {form.id ? tr("সংরক্ষণ") : tr("লিখে রাখুন")}
            </Button>
            {form.id ? (
              <Button full variant="secondary" onClick={removeEntry}>
                {tr("এই লেনদেন মুছুন")}
              </Button>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet open={editing} onClose={() => setEditing(false)} label={tr("ডিলারের তথ্য")}>
        <h2 className="text-lg font-bold">{tr("ডিলারের তথ্য")}</h2>
        <Field id="dealer-edit-name" label={tr("ডিলারের নাম")} maxLength={DEALER_NAME_MAX} value={editName} onChange={(e) => setEditName(e.target.value)} />
        <Field id="dealer-edit-phone" label={tr("মোবাইল নম্বর (ইচ্ছা হলে)")} inputMode="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
        {editError ? <Banner tone="danger">{editError}</Banner> : null}
        <Button full onClick={saveDealer} disabled={!editName.trim()}>
          {tr("সংরক্ষণ")}
        </Button>
        <Button full variant="secondary" onClick={deleteDealer}>
          {tr("এই ডিলার মুছুন")}
        </Button>
        <p className="text-sm text-muted">{tr("হিসাব পুরো মেটানো থাকলে তবেই ডিলার মোছা যায়।")}</p>
      </Sheet>
    </AppShell>
  )
}

export default function DealerDetailPage() {
  return (
    <Suspense fallback={<Splash />}>
      <DealerDetail />
    </Suspense>
  )
}
