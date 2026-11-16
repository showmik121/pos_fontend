"use client"

import { useState } from "react"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"
import { Field } from "./ui/field"
import { Segmented } from "./ui/segmented"
import { Scanner } from "./scanner"
import { Icon } from "./ui/icons"
import { toAsciiDigits } from "@/lib/format/bn"
import { domainMessage } from "@/lib/domain/errors"
import { parseTaka, takaInputValue } from "@/lib/domain/money"
import type { ProductInput } from "@/lib/store/actions"
import { UNIT_LABELS, type Product, type UnitLabel } from "@/lib/store/types"

const UNIT_OPTIONS = (Object.keys(UNIT_LABELS) as UnitLabel[]).map((value) => ({ value, label: UNIT_LABELS[value] }))

interface Props {
  /** সম্পাদনার সময় বিদ্যমান পণ্য */
  initial?: Product
  /** স্ক্যান করে না-পাওয়া বারকোড থেকে এলে আগে থেকে ভরা */
  initialBarcode?: string
  /** বারকোডহীন "খোলা" পণ্য */
  open?: boolean
  defaultMinStock: number
  submitLabel: string
  onSubmit: (input: ProductInput) => void
}

/** নতুন পণ্য / খোলা পণ্য / পণ্য সম্পাদনার ফর্ম */
export function ProductForm({ initial, initialBarcode = "", open = false, defaultMinStock, submitLabel, onSubmit }: Props) {
  const editing = Boolean(initial)
  const [name, setName] = useState(initial?.name ?? "")
  const [barcode, setBarcode] = useState(initialBarcode)
  const [unit, setUnit] = useState<UnitLabel>(initial?.unit ?? "piece")
  const [cost, setCost] = useState(initial ? takaInputValue(initial.costPoisha) : "")
  const [price, setPrice] = useState(initial ? takaInputValue(initial.pricePoisha) : "")
  const [carton, setCarton] = useState(initial ? String(initial.cartonSize) : "1")
  const [minStock, setMinStock] = useState(String(initial?.minStock ?? defaultMinStock))
  const [category, setCategory] = useState(initial?.category ?? "")
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const submit = () => {
    setError(null)
    const pricePoisha = parseTaka(price)
    const costPoisha = cost.trim() ? parseTaka(cost) : 0
    const cartonSize = Number(toAsciiDigits(carton))
    const min = Number(toAsciiDigits(minStock))
    if (pricePoisha == null) return setError("বিক্রয়মূল্য সঠিকভাবে দিন (যেমন ২৪০)")
    if (costPoisha == null) return setError("ক্রয়মূল্য সঠিক নয়")
    if (!Number.isInteger(cartonSize) || cartonSize < 1) return setError("কার্টনে পিসের সংখ্যা ১ বা তার বেশি হতে হবে")
    if (!Number.isInteger(min) || min < 0) return setError("সর্বনিম্ন স্টক সঠিক নয়")
    try {
      onSubmit({ name, unit, cartonSize, costPoisha, pricePoisha, minStock: min, category, barcode: open || editing ? null : barcode.trim() || null, open })
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      {open ? <Banner tone="info">বারকোড ছাড়া পণ্য (যেমন খোলা ওষুধ, লুজ আইটেম)। নাম দিয়ে খুঁজে বিক্রি হবে।</Banner> : null}
      <Field id="p-name" label="পণ্যের নাম" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      {!open && !editing ? (
        <Field
          id="p-barcode"
          label="বারকোড (ঐচ্ছিক)"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          trailing={
            <button type="button" onClick={() => setScanning(true)} aria-label="বারকোড স্ক্যান করুন" className="grid size-11 place-items-center rounded-lg text-brand active:bg-brand-soft">
              <Icon name="scan" />
            </button>
          }
        />
      ) : null}
      <div className="space-y-1.5">
        <span className="block text-sm font-medium">একক</span>
        <Segmented label="একক" options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="p-cost" label="ক্রয়মূল্য (প্রতি পিস)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Field id="p-price" label="বিক্রয়মূল্য (প্রতি পিস)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="p-carton" label="১ কার্টনে কত পিস" inputMode="numeric" value={carton} onChange={(e) => setCarton(e.target.value)} />
        <Field id="p-min" label="সর্বনিম্ন স্টক" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </div>
      <Field id="p-cat" label="ক্যাটেগরি (ঐচ্ছিক)" value={category} onChange={(e) => setCategory(e.target.value)} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button full onClick={submit}>
        {submitLabel}
      </Button>
      <Scanner
        open={scanning}
        onClose={() => setScanning(false)}
        onCode={(code) => {
          setBarcode(code)
          setScanning(false)
        }}
      />
    </div>
  )
}
