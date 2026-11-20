"use client"

import { tr } from "@/lib/i18n"
import { useState } from "react"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"
import { Field } from "./ui/field"
import { Segmented } from "./ui/segmented"
import { Scanner } from "./scanner"
import { Icon } from "./ui/icons"
import { toAsciiDigits } from "@/lib/format/bn"
import { domainMessage } from "@/lib/domain/errors"
import { parseMonthYear } from "@/lib/domain/dates"
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
  /** নতুন পণ্যে "শুরুর স্টক" ঘর দেখায় (সম্পাদনায় নয়) */
  withInitialStock?: boolean
  /** ওষুধের দোকানে মেয়াদের ঐচ্ছিক ঘরও দেখায় */
  showExpiry?: boolean
  onSubmit: (input: ProductInput, stock: InitialStock) => void
}

export interface InitialStock {
  /** পিসে; ০ = এখন স্টক তুলছেন না */
  qty: number
  expiryDate: string | null
}

/** নতুন পণ্য / খোলা পণ্য / পণ্য সম্পাদনার ফর্ম */
export function ProductForm({ initial, initialBarcode = "", open = false, defaultMinStock, submitLabel, withInitialStock = false, showExpiry = false, onSubmit }: Props) {
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
  const [stockQty, setStockQty] = useState("")
  const [expiry, setExpiry] = useState("")
  // একক/কার্টন/সর্বনিম্ন স্টক/ক্যাটেগরি ডিফল্টে লুকানো; ডিফল্টের বাইরে কিছু থাকলে (সম্পাদনা) খোলা
  const [more, setMore] = useState(
    (initial !== undefined && (initial.unit !== "piece" || initial.cartonSize !== 1 || initial.minStock !== defaultMinStock || Boolean(initial.category))),
  )

  const submit = () => {
    setError(null)
    const pricePoisha = parseTaka(price)
    const costPoisha = cost.trim() ? parseTaka(cost) : 0
    const cartonSize = Number(toAsciiDigits(carton))
    const min = Number(toAsciiDigits(minStock))
    if (pricePoisha == null) return setError(tr("বিক্রয়মূল্য সঠিকভাবে দিন (যেমন ২৪০)"))
    if (costPoisha == null) return setError(tr("ক্রয়মূল্য সঠিক নয়"))
    if (!Number.isInteger(cartonSize) || cartonSize < 1) {
      setMore(true)
      return setError(tr("কার্টনে পিসের সংখ্যা ১ বা তার বেশি হতে হবে"))
    }
    if (!Number.isInteger(min) || min < 0) {
      setMore(true)
      return setError(tr("সর্বনিম্ন স্টক সঠিক নয়"))
    }
    const qty = stockQty.trim() ? Number(toAsciiDigits(stockQty)) : 0
    if (withInitialStock && (!Number.isInteger(qty) || qty < 0)) return setError(tr("শুরুর স্টক ০ বা পূর্ণসংখ্যা দিন"))
    let expiryDate: string | null = null
    if (withInitialStock && showExpiry && qty > 0 && expiry.trim()) {
      expiryDate = parseMonthYear(expiry)
      if (!expiryDate) return setError(tr("মেয়াদ মাস/বছর আকারে দিন (যেমন ০৬/২০২৭)"))
    }
    try {
      onSubmit({ name, unit, cartonSize, costPoisha, pricePoisha, minStock: min, category, barcode: open || editing ? null : barcode.trim() || null, open }, { qty: withInitialStock ? qty : 0, expiryDate })
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      {open ? <Banner tone="info">{tr("বারকোড ছাড়া পণ্য (যেমন খোলা ওষুধ, লুজ আইটেম)। নাম দিয়ে খুঁজে বিক্রি হবে।")}</Banner> : null}
      <Field id="p-name" label={tr("পণ্যের নাম")} hint={tr("ইংরেজি বা বাংলা — যেভাবে লেখা সহজ, যেমন Pond's Cream")} lang="en" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      {!open && !editing ? (
        <Field
          id="p-barcode"
          label={tr("বারকোড (ঐচ্ছিক)")}
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          trailing={
            <button type="button" onClick={() => setScanning(true)} aria-label={tr("বারকোড স্ক্যান করুন")} className="grid size-11 place-items-center rounded-lg text-brand active:bg-brand-soft">
              <Icon name="scan" />
            </button>
          }
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field id="p-cost" label={tr("ক্রয়মূল্য (ঐচ্ছিক)")} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Field id="p-price" label={tr("বিক্রয়মূল্য")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <p className="-mt-2 text-sm text-muted">{tr("দাম প্রতি পিসের হিসাবে লিখুন। ক্রয়মূল্য দিলে লাভের হিসাব মেলে।")}</p>
      {withInitialStock ? (
        <>
          <Field id="p-stock" label={tr("এখন কতগুলো আছে (পিস)")} placeholder={tr("০")} inputMode="numeric" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          {showExpiry && Number(toAsciiDigits(stockQty)) > 0 ? <Field id="p-expiry" label={tr("মেয়াদ (ঐচ্ছিক, মাস/বছর)")} placeholder={tr("০৬/২০২৭")} inputMode="numeric" value={expiry} onChange={(e) => setExpiry(e.target.value)} /> : null}
        </>
      ) : null}
      <button
        type="button"
        aria-expanded={more}
        aria-controls="p-more"
        onClick={() => setMore((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-medium text-brand-dark active:bg-brand-soft"
      >
        <span>{more ? tr("কম দেখান") : tr("আরও তথ্য (একক, কার্টন, ক্যাটেগরি)")}</span>
        <Icon name="chevron" size={18} className={more ? "rotate-90" : ""} />
      </button>
      {more ? (
        <div id="p-more" className="space-y-4">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{tr("একক")}</span>
            <Segmented label={tr("একক")} options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="p-carton" label={tr("১ কার্টনে কত পিস")} inputMode="numeric" value={carton} onChange={(e) => setCarton(e.target.value)} />
            <Field id="p-min" label={tr("সর্বনিম্ন স্টক")} inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
          <Field id="p-cat" label={tr("ক্যাটেগরি (ঐচ্ছিক)")} lang="en" autoCapitalize="words" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      ) : null}
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
