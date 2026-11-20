"use client"

import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { ExpenseSheet } from "@/components/expense-sheet"
import { Banner } from "@/components/ui/banner"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, StatBox } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icons"
import { SearchBox } from "@/components/ui/inputs"
import { Sheet } from "@/components/ui/sheet"
import { todayIso } from "@/lib/domain/dates"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka } from "@/lib/domain/money"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { activeCategories, addExpenseCategory, CATEGORY_ICONS, CATEGORY_NAME_MAX, ensureDefaultCategories, expenseTotal, monthRange, removeExpenseCategory } from "@/lib/store/expenses"
import { cn } from "@/lib/cn"

export default function ExpensesPage() {
  const { db, update } = useDb()
  const { isOwner } = useSessionInfo()
  const today = todayIso()
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOwner && db.expenseCategories === undefined) update((d) => ensureDefaultCategories(d, new Date()))
  }, [isOwner, db.expenseCategories, update])

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activeCategories(db).filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [db, query])
  const [from, to] = monthRange(today)

  const saveCategory = () => {
    setError(null)
    try {
      update((d) => addExpenseCategory(d, { name, icon }, new Date()).db)
      setAdding(false)
      setName("")
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  if (!isOwner) {
    return (
      <AppShell title="খরচ" backHref="/">
        <Banner tone="warn">খরচের হিসাব শুধু মালিক দেখতে ও লিখতে পারেন।</Banner>
      </AppShell>
    )
  }

  return (
    <AppShell title="খরচ" backHref="/">
      <div className="flex gap-3">
        <StatBox label="আজকের খরচ" value={formatTaka(expenseTotal(db, today, today))} />
        <StatBox label="এই মাসের খরচ" value={formatTaka(expenseTotal(db, from, to))} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => { setError(null); setAdding(true) }}>
          <Icon name="plus" size={18} /> নতুন ক্যাটেগরি
        </Button>
        <LinkButton href="/expenses/book">খরচের খাতা</LinkButton>
      </div>

      <SearchBox id="cat-search" label="ক্যাটেগরি খুঁজুন" placeholder="ক্যাটেগরি খুঁজুন…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {categories.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">কোনো ক্যাটেগরি নেই।</Card>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setPicked(c.id)} className={cn("card-surface flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border border-line/80 bg-white px-2 py-3 text-center active:bg-canvas")}>
              <span aria-hidden="true" className="text-[34px] leading-none">{c.icon}</span>
              <span className="text-[14px] font-medium leading-tight">{c.name}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-sm text-muted">ক্যাটেগরি চাপলে খরচ লেখার ঘর খুলবে।</p>

      <ExpenseSheet open={picked !== null} onClose={() => setPicked(null)} categoryId={picked ?? ""} />

      <Sheet open={adding} onClose={() => setAdding(false)} label="নতুন ক্যাটেগরি">
        <h2 className="text-lg font-bold">নতুন ক্যাটেগরি</h2>
        <Field id="cat-name" label="ক্যাটেগরির নাম" placeholder="যেমন: চা-নাস্তা" maxLength={CATEGORY_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div role="radiogroup" aria-label="ছবি" className="flex flex-wrap gap-2">
          {CATEGORY_ICONS.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icon === i} onClick={() => setIcon(i)} className={cn("grid size-12 place-items-center rounded-xl text-2xl", icon === i ? "border-[1.5px] border-brand bg-brand-soft" : "border border-line-strong bg-white")}>
              {i}
            </button>
          ))}
        </div>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button full onClick={saveCategory} disabled={!name.trim()}>
          ক্যাটেগরি যোগ করুন
        </Button>
        {categories.length > 0 ? (
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2.5 text-muted">কোনো ক্যাটেগরি মুছতে চান?</summary>
            <div className="flex flex-wrap gap-2 pt-1">
              {activeCategories(db).map((c) => (
                <button key={c.id} type="button" className="min-h-10 rounded-full border border-line-strong bg-white px-3 text-danger" onClick={() => update((d) => removeExpenseCategory(d, c.id))}>
                  {c.icon} {c.name} মুছুন
                </button>
              ))}
            </div>
            <p className="pt-2 text-muted">মুছলেও আগের খরচ খাতায় থাকবে।</p>
          </details>
        ) : null}
      </Sheet>
    </AppShell>
  )
}
