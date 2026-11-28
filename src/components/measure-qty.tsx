"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { formatMeasureQty, measureInputValue, MEASURE_QUICK, parseMeasureQty, type Measure } from "@/lib/domain/measure"
import { tr } from "@/lib/i18n"

/** কেজি/লিটারের পণ্যের পরিমাণ: বর্তমান ওজন, ওজন লেখার ঘর ও দ্রুত যোগের বোতাম। `qty` পিসে (১ পিস = ০.০১ কেজি) */
export function MeasureQty({ id, measure, qty, onChange }: { id: string; measure: Measure; qty: number; onChange: (pieces: number) => void }) {
  const [text, setText] = useState(measureInputValue(qty))
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setText(measureInputValue(qty))
    setBad(false)
  }, [qty])

  const commit = () => {
    const pieces = parseMeasureQty(text)
    if (pieces == null) return setBad(true)
    setBad(false)
    if (pieces !== qty) onChange(pieces)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {measure === "kg" ? tr("ওজন (কেজি)") : tr("পরিমাণ (লিটার)")}
        </label>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
          }}
          aria-invalid={bad || undefined}
          className={`min-h-11 w-24 rounded-xl border bg-white px-3 text-base ${bad ? "border-danger" : "border-line-strong"}`}
        />
        <span className="text-[13px] font-medium text-brand-dark">{formatMeasureQty(qty, measure)}</span>
      </div>
      {bad ? <p className="text-[13px] text-danger">{tr("সংখ্যা ঠিকভাবে দিন (যেমন ২.৫ বা ০.২৫)")}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr("দ্রুত যোগ করুন")}>
        {MEASURE_QUICK.map((q) => (
          <Button key={q} variant="secondary" className="min-h-11 px-3 text-sm" onClick={() => onChange(qty + q)}>
            +{formatMeasureQty(q, measure)}
          </Button>
        ))}
      </div>
    </div>
  )
}
