"use client"

import { tr } from "@/lib/i18n"
import { useEffect, useState } from "react"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"
import { Field } from "./ui/field"
import { Sheet } from "./ui/sheet"
import { useDb } from "./db-provider"
import { todayIso } from "@/lib/domain/dates"
import { domainMessage } from "@/lib/domain/errors"
import { parseTaka, takaInputValue } from "@/lib/domain/money"
import { useSessionInfo } from "@/lib/hooks/use-session"
import { activeCategories, addExpense, EXPENSE_NOTE_MAX, removeExpense, updateExpense } from "@/lib/store/expenses"
import type { Expense } from "@/lib/store/types"

interface Props {
  open: boolean
  onClose: () => void
  /** নতুন খরচে ঠিক করা ক্যাটেগরি; বদলের সময় খরচের নিজের ক্যাটেগরি */
  categoryId: string
  /** দিলে বদল/মোছার মোড */
  expense?: Expense
}

/** খরচ যোগ বা বদলের শিট */
export function ExpenseSheet({ open, onClose, categoryId, expense }: Props) {
  const { db, update } = useDb()
  const { actor } = useSessionInfo()
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState("")
  const [cat, setCat] = useState(categoryId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(expense ? takaInputValue(expense.amount) : "")
    setDate(expense?.date ?? todayIso())
    setNote(expense?.note ?? "")
    setCat(expense?.categoryId ?? categoryId)
    setError(null)
  }, [open, expense, categoryId])

  const categories = activeCategories(db)
  const current = db.expenseCategories?.find((c) => c.id === cat)

  const save = () => {
    setError(null)
    const poisha = parseTaka(amount)
    if (poisha == null || poisha <= 0) return setError(tr("খরচের পরিমাণ সঠিকভাবে দিন"))
    try {
      update((d) => (expense ? updateExpense(d, expense.id, { categoryId: cat, amount: poisha, note, date }, new Date()) : addExpense(d, { categoryId: cat, amount: poisha, note, date }, actor, new Date())))
      onClose()
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  const remove = () => {
    if (!expense) return
    update((d) => removeExpense(d, expense.id))
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} label={expense ? tr("খরচ বদল") : tr("খরচ লিখুন")}>
      <h2 className="text-lg font-bold">
        {current ? `${current.icon} ${tr(current.name)}` : tr("খরচ")}
        {expense ? tr(" — বদল") : ""}
      </h2>
      <Field id="exp-amount" label={tr("কত টাকা খরচ")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      <Field id="exp-date" label={tr("তারিখ")} type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
      {expense ? (
        <div className="space-y-1.5">
          <label htmlFor="exp-cat" className="block text-sm font-medium text-ink">
            {tr("ক্যাটেগরি")}
          </label>
          <select id="exp-cat" value={cat} onChange={(e) => setCat(e.target.value)} className="min-h-12 w-full rounded-xl border border-line-strong bg-white px-3 text-base">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {tr(c.name)}
              </option>
            ))}
            {!categories.some((c) => c.id === cat) && current ? <option value={cat}>{tr(current.name)} {tr("(মোছা)")}</option> : null}
          </select>
        </div>
      ) : null}
      <Field id="exp-note" label={tr("নোট (ইচ্ছা হলে)")} placeholder={tr("যেমন: নভেম্বরের ভাড়া")} maxLength={EXPENSE_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button full onClick={save}>
        {expense ? tr("সংরক্ষণ") : tr("খরচ লিখুন")}
      </Button>
      {expense ? (
        <Button full variant="secondary" onClick={remove}>
          {tr("এই খরচ মুছুন")}
        </Button>
      ) : null}
    </Sheet>
  )
}
