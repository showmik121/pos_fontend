"use client"

import { tr, tf } from "@/lib/i18n"
import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, Pill, SectionTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Chips } from "@/components/ui/segmented"
import { todayIso } from "@/lib/domain/dates"
import { domainMessage } from "@/lib/domain/errors"
import { toBanglaDigits } from "@/lib/format/bn"
import { addNote, NOTE_KIND_LABEL, NOTE_TEXT_MAX, outOfStockSuggestions, pendingNoteCount, removeNote, setNoteDone, visibleNotes } from "@/lib/store/notes"
import type { Note } from "@/lib/store/types"

const KINDS = (Object.keys(NOTE_KIND_LABEL) as Note["kind"][]).map((value) => ({ value, label: NOTE_KIND_LABEL[value] }))
const KIND_TONE = { out: "danger", request: "warn", other: "neutral" } as const

export default function NotesPage() {
  const { db, update } = useDb()
  const today = todayIso()
  const [text, setText] = useState("")
  const [kind, setKind] = useState<Note["kind"]>("request")
  const [customerName, setCustomerName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const notes = useMemo(() => visibleNotes(db), [db])
  const suggestions = useMemo(() => outOfStockSuggestions(db, today), [db, today])

  const add = () => {
    setError(null)
    try {
      update((d) => addNote(d, { text, kind, customerName }, new Date()))
      setText("")
      setCustomerName("")
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <AppShell title={tr("আনতে হবে")} backHref="/">
      <Card className="space-y-3 p-4">
        <Chips value={kind} onChange={setKind} options={KINDS} />
        <Field id="note-text" label={tr("কী আনতে হবে")} placeholder={kind === "request" ? tr("যেমন: পন্ডস ক্রিম ২টা") : tr("পণ্যের নাম ও কত")} maxLength={NOTE_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        {kind === "request" ? <Field id="note-customer" label={tr("কে চেয়েছে (ইচ্ছা হলে)")} placeholder={tr("কাস্টমারের নাম")} maxLength={60} value={customerName} onChange={(e) => setCustomerName(e.target.value)} /> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button full onClick={add} disabled={!text.trim()}>
          {tr("নোটে রাখুন")}
        </Button>
      </Card>

      {suggestions.length > 0 ? (
        <>
          <SectionTitle>{tr("স্টক শেষ — এক ট্যাপে নোটে তুলুন")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 12).map((p) => (
              <button
                key={p.id}
                type="button"
                className="min-h-10 rounded-full border border-line-strong bg-white px-3 text-sm font-medium active:bg-canvas"
                onClick={() => update((d) => addNote(d, { text: p.name, kind: "out", productId: p.id }, new Date()))}
              >
                + {p.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>{tr("নোট (")}{toBanglaDigits(pendingNoteCount(db))}{tr("টি বাকি)")}</SectionTitle>
      {notes.length === 0 ? (
        <Card className="px-4 py-6 text-center text-muted">{tr("এখনো কোনো নোট নেই।")}</Card>
      ) : (
        <Card className="divide-y divide-line">
          {notes.map((n) => (
            <div key={n.id} className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                aria-label={tf("{p0} — আনা হয়েছে", { p0: (n.text) })}
                className="size-6 flex-none accent-brand"
                checked={n.done}
                onChange={(e) => update((d) => setNoteDone(d, n.id, e.target.checked))}
              />
              <div className={`min-w-0 flex-1 ${n.done ? "text-muted line-through" : ""}`}>
                <div className="font-medium leading-snug">{n.text}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <Pill tone={KIND_TONE[n.kind]}>{tr(NOTE_KIND_LABEL[n.kind])}</Pill>
                  {n.customerName ? <span>{n.customerName}</span> : null}
                </div>
              </div>
              <button type="button" aria-label={tf("{p0} মুছুন", { p0: (n.text) })} className="min-h-10 flex-none px-2 text-sm text-danger" onClick={() => update((d) => removeNote(d, n.id))}>
                {tr("মুছুন")}
              </button>
            </div>
          ))}
        </Card>
      )}
      <p className="text-center text-sm text-muted">{tr("টিক দিলে আনা হয়েছে ধরা হয়, তালিকার নিচে চলে যায়।")}</p>
    </AppShell>
  )
}
