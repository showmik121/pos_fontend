"use client"

import { tr } from "@/lib/i18n"
import { Button } from "./ui/button"
import { Field } from "./ui/field"
import { toBanglaDigits } from "@/lib/format/bn"
import { expiryAfterYears, formatExpiryInput, normalizeExpiryInput } from "@/lib/domain/expiry-input"

const QUICK_YEARS = [1, 2, 3] as const

/** মেয়াদের ঘর: লেখার সময় নিজে "/" বসে ("0627" → "06/27"), আর `quick` দিলে ১/২/৩ বছর পরের দ্রুত বোতাম */
export function ExpiryField({ id, label, value, onChange, quick = false }: { id: string; label: string; value: string; onChange: (v: string) => void; quick?: boolean }) {
  return (
    <div className="space-y-2">
      <Field id={id} label={label} placeholder={tr("০৬/২০২৭")} inputMode="numeric" value={value} onChange={(e) => onChange(formatExpiryInput(e.target.value))} onBlur={() => onChange(normalizeExpiryInput(value))} autoComplete="off" />
      {quick ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("দ্রুত মেয়াদ")}>
          {QUICK_YEARS.map((y) => (
            <Button key={y} variant="secondary" className="min-h-11 px-3 text-sm" onClick={() => onChange(expiryAfterYears(y, new Date()))}>
              +{toBanglaDigits(y)} {tr("বছর")}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
