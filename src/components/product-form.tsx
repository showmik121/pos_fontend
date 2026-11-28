"use client"

import { tf, tr } from "@/lib/i18n"
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
import { normalizeExpiryInput } from "@/lib/domain/expiry-input"
import { CompanyPicker } from "./company-picker"
import { ExpiryField } from "./expiry-field"
import { parseTaka, takaInputValue } from "@/lib/domain/money"
import { measureInputValue, measureName, parseMeasureQty, perMeasurePoisha, perPiecePoishaFromMeasure, type Measure } from "@/lib/domain/measure"
import type { ProductInput } from "@/lib/store/actions"
import { DOSAGE_FORMS, PHARMA_TEXT_MAX, UNIT_LABELS, VARIANT_TEXT_MAX, type DosageForm, type Product, type UnitLabel } from "@/lib/store/types"

const FORM_KEYS = Object.keys(DOSAGE_FORMS) as DosageForm[]
const UNIT_OPTIONS = (Object.keys(UNIT_LABELS) as UnitLabel[]).map((value) => ({ value, label: UNIT_LABELS[value] }))

interface Props {
  /** সম্পাদনার সময় বিদ্যমান পণ্য */
  initial?: Product
  /** "আরেকটি ভ্যারিয়েন্ট": এই পণ্যের নাম, দাম, ক্যাটেগরি ইত্যাদি নতুন ফর্মে আগে থেকে ভরা (বারকোড, ভ্যারিয়েন্ট, স্টক খালি) */
  prefill?: Product
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
  /** ফার্মেসি: জেনেরিক নাম, শক্তি, ধরন ও কোম্পানির ঘর দেখায় */
  pharmacy?: boolean
  /** addAnother = true: সেভ করে একই ফ্যামিলির পরের ভ্যারিয়েন্টের ফর্ম খুলবে */
  onSubmit: (input: ProductInput, stock: InitialStock, addAnother: boolean) => void
}

export interface InitialStock {
  /** পিসে; ০ = এখন স্টক তুলছেন না */
  qty: number
  expiryDate: string | null
}

/** নতুন পণ্য / খোলা পণ্য / পণ্য সম্পাদনার ফর্ম */
export function ProductForm({ initial, prefill, initialBarcode = "", open = false, defaultMinStock, submitLabel, withInitialStock = false, showExpiry = false, pharmacy = false, onSubmit }: Props) {
  const editing = Boolean(initial)
  const src = initial ?? prefill
  const [name, setName] = useState(src?.family ?? src?.name ?? "")
  const [variant, setVariant] = useState(initial?.variant ?? "")
  // কেজি/লিটারের পণ্য: নতুন পণ্যে বাছা যায়, পরে বদলানো যায় না; "আরেকটি ভ্যারিয়েন্ট"-এ আগেরটাই চলে
  const [measure, setMeasure] = useState<Measure | null>(src?.measure ?? null)
  const measured = measure != null
  const [sack, setSack] = useState(src?.measure && src.cartonSize > 1 ? measureInputValue(src.cartonSize) : "")
  const [minMeasure, setMinMeasure] = useState(src?.measure && src.minStock > 0 ? measureInputValue(src.minStock) : "")
  const [barcode, setBarcode] = useState(initialBarcode)
  const [unit, setUnit] = useState<UnitLabel>(src?.unit ?? "piece")
  const [cost, setCost] = useState(src ? takaInputValue(src.measure ? perMeasurePoisha(src.costPoisha) : src.costPoisha) : "")
  const [price, setPrice] = useState(src ? takaInputValue(src.measure ? perMeasurePoisha(src.pricePoisha) : src.pricePoisha) : "")
  const [carton, setCarton] = useState(src ? String(src.cartonSize) : "1")
  const [minStock, setMinStock] = useState(String(src?.minStock ?? defaultMinStock))
  const [category, setCategory] = useState(src?.category ?? "")
  const [generic, setGeneric] = useState(initial?.generic ?? "")
  const [strength, setStrength] = useState(initial?.strength ?? "")
  const [form, setForm] = useState<DosageForm | "">(initial?.form ?? "")
  const [company, setCompany] = useState(initial?.company ?? "")
  const [strip, setStrip] = useState(initial?.stripSize ? String(initial.stripSize) : "")
  // পাতার দাম লেখার ঘর: লেখার সময় নিজের লেখা, নইলে পিসের দাম থেকে হিসাব করা
  const [stripPriceDraft, setStripPriceDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [stockQty, setStockQty] = useState("")
  const [expiry, setExpiry] = useState("")
  // একক/কার্টন/সর্বনিম্ন স্টক/ক্যাটেগরি ডিফল্টে লুকানো; ডিফল্টের বাইরে কিছু থাকলে (সম্পাদনা) খোলা
  const [more, setMore] = useState(
    (src !== undefined && (src.unit !== "piece" || src.cartonSize !== 1 || src.minStock !== defaultMinStock || Boolean(src.category))),
  )

  const stripN = pharmacy ? Number(toAsciiDigits(strip)) || 1 : 1
  const pricePoishaNow = parseTaka(price)
  const stripPriceShown = pricePoishaNow != null && stripN > 1 ? takaInputValue(pricePoishaNow * stripN) : ""
  const typedStrip = stripPriceDraft != null ? parseTaka(stripPriceDraft) : null
  const stripPriceHint =
    typedStrip != null && typedStrip % stripN !== 0
      ? tr("এই দামে পিসের দাম পূর্ণ পয়সা হয় না — প্রতি পিসের দাম নিজে লিখুন")
      : tr("পাতার দাম লিখলে প্রতি পিসের দাম নিজেই বসে যায়")

  const submit = (addAnother = false) => {
    setError(null)
    const typedPrice = parseTaka(price)
    const typedCost = cost.trim() ? parseTaka(cost) : 0
    // কেজি/লিটারে: দাম প্রতি কেজির (পূর্ণ টাকা), ভেতরে প্রতি ০.০১ কেজির দামে রাখা হয়
    const pricePoisha = measured && typedPrice != null ? perPiecePoishaFromMeasure(typedPrice) : typedPrice
    const costPoisha = measured && typedCost != null ? perPiecePoishaFromMeasure(typedCost, false) : typedCost
    if (measured && typedPrice != null && pricePoisha == null) return setError(tr("কেজি বা লিটারের দাম পূর্ণ টাকায় দিন (যেমন ৮৫)"))
    const sackPieces = sack.trim() ? parseMeasureQty(sack) : 1
    if (measured && sackPieces == null) {
      setMore(true)
      return setError(tr("বস্তার ওজন সঠিক নয় (যেমন ২৫)"))
    }
    const minPieces = minMeasure.trim() ? parseMeasureQty(minMeasure) : 0
    if (measured && minPieces == null) {
      setMore(true)
      return setError(tr("সর্বনিম্ন স্টক সঠিক নয় (যেমন ৫)"))
    }
    const cartonSize = measured ? (sackPieces ?? 1) : Number(toAsciiDigits(carton))
    const min = measured ? (minPieces ?? 0) : Number(toAsciiDigits(minStock))
    const stripSize = strip.trim() ? Number(toAsciiDigits(strip)) : 1
    if (pharmacy && (!Number.isInteger(stripSize) || stripSize < 1)) return setError(tr("পাতায় পিসের সংখ্যা ১ বা তার বেশি হতে হবে"))
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
    const qty = measured ? (stockQty.trim() ? (parseMeasureQty(stockQty) ?? -1) : 0) : stockQty.trim() ? Number(toAsciiDigits(stockQty)) : 0
    if (withInitialStock && (!Number.isInteger(qty) || qty < 0)) return setError(measured ? tr("শুরুর স্টক সঠিক নয় (যেমন ২.৫)") : tr("শুরুর স্টক ০ বা পূর্ণসংখ্যা দিন"))
    let expiryDate: string | null = null
    if (pharmacy && withInitialStock && showExpiry && qty > 0 && !expiry.trim()) return setError(tr("মেয়াদ দিন (মাস/বছর)"))
    if (withInitialStock && showExpiry && qty > 0 && expiry.trim()) {
      expiryDate = parseMonthYear(normalizeExpiryInput(expiry))
      if (!expiryDate) return setError(tr("মেয়াদ মাস/বছর আকারে দিন (যেমন ০৬/২০২৭)"))
    }
    try {
      onSubmit({ name, unit, cartonSize, costPoisha, pricePoisha, minStock: min, category, stripSize: pharmacy ? stripSize : undefined, generic, strength, form: form || null, company, variant: pharmacy ? undefined : variant, measure: measure ?? undefined, barcode: open || editing ? null : barcode.trim() || null, open }, { qty: withInitialStock ? qty : 0, expiryDate }, addAnother)
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      {open ? <Banner tone="info">{tr("বারকোড ছাড়া পণ্য (যেমন খোলা ওষুধ, লুজ আইটেম)। নাম দিয়ে খুঁজে বিক্রি হবে।")}</Banner> : null}
      <Field id="p-name" label={tr("পণ্যের নাম")} hint={pharmacy ? tr("ব্র্যান্ড নাম, ইংরেজি বা বাংলা — যেমন Napa") : tr("ইংরেজি বা বাংলা — যেভাবে লেখা সহজ, যেমন Pond's Cream")} lang="en" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      {!pharmacy ? (
        <Field id="p-variant" label={tr("ভ্যারিয়েন্ট — শেড বা সাইজ (ঐচ্ছিক)")} hint={tr("যেমন ৫০ml বা শেড ০২ — একই পণ্যের সব ভ্যারিয়েন্ট স্টকে এক সারিতে থাকবে")} maxLength={VARIANT_TEXT_MAX.variant} autoFocus={Boolean(prefill)} value={variant} onChange={(e) => setVariant(e.target.value)} autoComplete="off" />
      ) : null}
      {pharmacy ? (
        <>
          <Field id="p-generic" label={tr("জেনেরিক নাম (ঐচ্ছিক)")} hint={tr("যেমন Paracetamol — বাংলা বা ইংরেজি, দুটো দিয়েই খোঁজা যাবে")} maxLength={PHARMA_TEXT_MAX.generic} autoCapitalize="words" value={generic} onChange={(e) => setGeneric(e.target.value)} autoComplete="off" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="p-strength" label={tr("শক্তি (ঐচ্ছিক)")} placeholder="500 mg" maxLength={PHARMA_TEXT_MAX.strength} value={strength} onChange={(e) => setStrength(e.target.value)} autoComplete="off" />
            <div className="space-y-1.5">
              <label htmlFor="p-form" className="block text-sm font-medium text-ink">
                {tr("ধরন (ঐচ্ছিক)")}
              </label>
              <select id="p-form" value={form} onChange={(e) => setForm(e.target.value as DosageForm | "")} className="min-h-12 w-full rounded-xl border border-line-strong bg-white px-3 text-base text-ink focus:border-brand focus:outline-2 focus:outline-brand/30">
                <option value="">{tr("— বাছুন —")}</option>
                {FORM_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {tr(DOSAGE_FORMS[k])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Field id="p-strip" label={tr("১ পাতায় কত পিস (ঐচ্ছিক)")} hint={tr("যেমন ১০ — দিলে পাতা ও খুচরা পিস দুভাবেই বিক্রি ও স্টক হবে")} inputMode="numeric" value={strip} onChange={(e) => setStrip(e.target.value)} autoComplete="off" />
          <CompanyPicker value={company} onChange={setCompany} />
        </>
      ) : null}
      {!pharmacy && !editing && !prefill ? (
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{tr("কীভাবে বিক্রি হয়")}</span>
          <Segmented
            label={tr("বিক্রির ধরন")}
            options={[
              { value: "piece" as const, label: tr("পিস") },
              { value: "kg" as const, label: tr("কেজি") },
              { value: "l" as const, label: tr("লিটার") },
            ]}
            value={measure ?? "piece"}
            onChange={(v) => setMeasure(v === "piece" ? null : v)}
          />
          {measured ? <p className="text-sm text-muted">{tr("ওজন বা মাপ অনুযায়ী বিক্রি হবে (০.২৫ কেজি, ২.৫ লিটার)। দাম প্রতি একক, পূর্ণ টাকায়।")}</p> : null}
        </div>
      ) : null}
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
        <Field id="p-cost" label={measured ? tf("ক্রয়মূল্য (প্রতি {p0}, ঐচ্ছিক)", { p0: measureName(measure) }) : tr("ক্রয়মূল্য (ঐচ্ছিক)")} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Field id="p-price" label={measured ? tf("বিক্রয়মূল্য (প্রতি {p0})", { p0: measureName(measure) }) : tr("বিক্রয়মূল্য")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <p className="-mt-2 text-sm text-muted">{measured ? tr("বিক্রয়মূল্য প্রতি কেজি/লিটারের, পূর্ণ টাকায়। ক্রয়মূল্য দিলে লাভের হিসাব মেলে।") : tr("দাম প্রতি পিসের হিসাবে লিখুন। ক্রয়মূল্য দিলে লাভের হিসাব মেলে।")}</p>
      {stripN > 1 ? (
        <Field
          id="p-strip-price"
          label={tr("প্রতি পাতার বিক্রয়মূল্য")}
          hint={stripPriceHint}
          inputMode="decimal"
          value={stripPriceDraft ?? stripPriceShown}
          onChange={(e) => {
            const text = e.target.value
            setStripPriceDraft(text)
            const poisha = parseTaka(text)
            if (poisha != null && poisha % stripN === 0) setPrice(takaInputValue(poisha / stripN))
          }}
          onBlur={() => setStripPriceDraft(null)}
        />
      ) : null}
      {withInitialStock ? (
        <>
          <Field id="p-stock" label={measured ? tf("এখন কত {p0} আছে", { p0: measureName(measure) }) : tr("এখন কতগুলো আছে (পিস)")} placeholder={tr("০")} inputMode={measured ? "decimal" : "numeric"} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          {showExpiry && Number(toAsciiDigits(stockQty)) > 0 ? <ExpiryField id="p-expiry" label={pharmacy ? tr("মেয়াদ (মাস/বছর)") : tr("মেয়াদ (ঐচ্ছিক, মাস/বছর)")} value={expiry} onChange={setExpiry} quick={pharmacy} /> : null}
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
          {measured ? (
            <div className="grid grid-cols-2 gap-3">
              <Field id="p-sack" label={tf("১ বস্তায় কত {p0} (ঐচ্ছিক)", { p0: measureName(measure) })} inputMode="decimal" value={sack} onChange={(e) => setSack(e.target.value)} />
              <Field id="p-min-measure" label={tf("সর্বনিম্ন স্টক ({p0})", { p0: measureName(measure) })} inputMode="decimal" value={minMeasure} onChange={(e) => setMinMeasure(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium">{tr("একক")}</span>
                <Segmented label={tr("একক")} options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="p-carton" label={pharmacy ? tr("১ বক্সে কত পিস") : tr("১ কার্টনে কত পিস")} inputMode="numeric" value={carton} onChange={(e) => setCarton(e.target.value)} />
                <Field id="p-min" label={tr("সর্বনিম্ন স্টক")} inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
              </div>
            </>
          )}
          <Field id="p-cat" label={tr("ক্যাটেগরি (ঐচ্ছিক)")} lang="en" autoCapitalize="words" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button full onClick={() => submit(false)}>
        {submitLabel}
      </Button>
      {!pharmacy && !editing && variant.trim() ? (
        <Button full variant="secondary" onClick={() => submit(true)}>
          {tr("সেভ করে আরেকটি ভ্যারিয়েন্ট")}
        </Button>
      ) : null}
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
