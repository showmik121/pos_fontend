"use client"

import { tr } from "@/lib/i18n"
import { useState } from "react"
import { useDb } from "./db-provider"
import { Field } from "./ui/field"
import { companyOptions } from "@/lib/store/companies"
import { PHARMA_TEXT_MAX } from "@/lib/store/types"

const OTHER = "__other"

/** কোম্পানি বাছাই: ড্রপডাউনে পরিচিত ও আগে ব্যবহার-করা কোম্পানি, না থাকলে "অন্য" বেছে নিজে লেখা */
export function CompanyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { db } = useDb()
  const options = companyOptions(db, value)
  const [custom, setCustom] = useState(false)
  const selected = custom ? OTHER : value
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="p-company" className="block text-sm font-medium text-ink">
          {tr("কোম্পানি (ঐচ্ছিক)")}
        </label>
        <select
          id="p-company"
          value={selected}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setCustom(true)
              onChange("")
            } else {
              setCustom(false)
              onChange(e.target.value)
            }
          }}
          className="min-h-12 w-full rounded-xl border border-line-strong bg-white px-3 text-base text-ink focus:border-brand focus:outline-2 focus:outline-brand/30"
        >
          <option value="">{tr("— বাছুন —")}</option>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={OTHER}>{tr("অন্য (নিজে লিখুন)")}</option>
        </select>
      </div>
      {custom ? <Field id="p-company-other" label={tr("কোম্পানির নাম")} maxLength={PHARMA_TEXT_MAX.company} autoCapitalize="words" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" autoFocus /> : null}
    </div>
  )
}
