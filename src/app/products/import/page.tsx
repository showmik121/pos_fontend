"use client"

import { tr, tf } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useDb } from "@/components/db-provider"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Card, KeyValue, RowList } from "@/components/ui/card"
import { Icon } from "@/components/ui/icons"
import { domainMessage } from "@/lib/domain/errors"
import { formatCount } from "@/lib/domain/money"
import { importProducts } from "@/lib/store/actions"
import { IMPORT_HEADERS, IMPORT_TEMPLATE_CSV, MAX_IMPORT_BYTES, parseCsv, validateImport, type ImportRow, type ImportRowError } from "@/lib/store/csv"

interface Parsed {
  fileName: string
  ok: ImportRow[]
  errors: ImportRowError[]
}

export default function ImportPage() {
  const { db, update } = useDb()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [error, setError] = useState<string | null>(null)

  const downloadTemplate = () => {
    // BOM দিলে Excel বাংলা অক্ষর ঠিকভাবে খোলে
    const blob = new Blob(["﻿", IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "products-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File) => {
    setError(null)
    setParsed(null)
    if (file.size > MAX_IMPORT_BYTES) return setError(tr("ফাইলটি অনেক বড় (সর্বোচ্চ ১ MB)। ছোট ছোট ফাইলে ভাগ করে দিন।"))
    try {
      const text = (await file.text()).replace(/^﻿/, "")
      const rows = parseCsv(text)
      if (rows.length < 2) return setError(tr("ফাইলে কোনো তথ্য পাওয়া যায়নি। টেমপ্লেট অনুযায়ী লিখুন।"))
      const { ok, errors } = validateImport(rows, db)
      setParsed({ fileName: file.name, ok, errors })
    } catch {
      setError(tr("ফাইলটি পড়া যায়নি। CSV ফাইল দিন (Excel হলে 'CSV হিসেবে সেভ করুন')।"))
    }
  }

  const confirm = () => {
    if (!parsed || parsed.ok.length === 0) return
    try {
      update((d) => importProducts(d, parsed.ok, new Date()))
      router.replace("/stock")
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <AppShell
      title={tr("CSV থেকে পণ্য আনুন")}
      backHref="/stock"
      footer={
        parsed ? (
          <Button full onClick={confirm} disabled={parsed.ok.length === 0}>
            {formatCount(parsed.ok.length)}{tr("টি পণ্য আনুন")}
          </Button>
        ) : undefined
      }
    >
      <Card className="space-y-2 p-4">
        <p className="font-medium">{tr("ধাপ ১: টেমপ্লেট নামান")}</p>
        <p className="text-sm text-muted">{tr("কলাম:")} {IMPORT_HEADERS.join(", ")}{tr("। মেয়াদ লিখুন মাস/বছর (০৬/২০২৭)। দাম টাকায়।")}</p>
        <Button variant="secondary" onClick={downloadTemplate}>
          <Icon name="download" /> {tr("টেমপ্লেট নামান")}
        </Button>
      </Card>

      <Card className="space-y-2 p-4">
        <p className="font-medium">{tr("ধাপ ২: ফাইল বাছুন")}</p>
        <p className="text-sm text-muted">{tr("Excel হলে আগে &quot;CSV হিসেবে সেভ করুন&quot;। Excel (.xlsx) সরাসরি এখনো চলে না।")}</p>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label={tr("CSV ফাইল বাছুন")}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          <Icon name="file" /> {tr("CSV ফাইল বাছুন")}
        </Button>
      </Card>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {parsed ? (
        <>
          <p className="text-[15px] font-semibold">{tr("ধাপ ৩: যাচাই —")} {parsed.fileName}</p>
          <RowList>
            <KeyValue label={tr("ঠিক আছে")} value={tf("{p0}টি", { p0: (formatCount(parsed.ok.length)) })} />
            <KeyValue label={tr("ভুল আছে (বাদ যাবে)")} value={tf("{p0}টি", { p0: (formatCount(parsed.errors.length)) })} />
          </RowList>
          {parsed.errors.length > 0 ? (
            <Card className="divide-y divide-line">
              {parsed.errors.slice(0, 50).map((e) => (
                <div key={`${e.line}-${e.message}`} className="px-4 py-2 text-sm">
                  <span className="font-medium">{tr("লাইন")} {formatCount(e.line)}:</span> <span className="text-danger">{e.message}</span>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </AppShell>
  )
}
