"use client"

import { tr } from "@/lib/i18n"
import { useEffect, useRef, useState } from "react"
import { downloadBackup } from "@/lib/browser/backup-download"
import { requestPersistentStorage } from "@/lib/browser/persist"
import { domainMessage } from "@/lib/domain/errors"
import { toBanglaDigits } from "@/lib/format/bn"
import { parseBackup, storageStatus, type ParsedBackup } from "@/lib/store/backup"
import { dbStorageChars } from "@/lib/store/db"
import { useDb } from "./db-provider"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"

/** সেটিংসে: ব্যাকআপ নামানো, ব্যাকআপ থেকে ফেরানো, আর ফোনের জায়গা কতটা ভরেছে তার সতর্কতা */
export function BackupSection({ storeId }: { storeId: string }) {
  const { db, update } = useDb()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null)

  const usage = storageStatus(dbStorageChars(storeId))
  const [persistent, setPersistent] = useState<boolean | null>(true)

  useEffect(() => {
    void requestPersistentStorage().then(setPersistent)
  }, [])

  const download = () => {
    downloadBackup(db, storeId)
    setMessage({ tone: "info", text: tr("ব্যাকআপ ফাইল নামানো হয়েছে। ফাইলটি নিরাপদ জায়গায় (গুগল ড্রাইভ বা অন্য ফোনে) রাখুন।") })
  }

  const onFile = async (file: File) => {
    setMessage(null)
    setPending(null)
    try {
      setPending(parseBackup(await file.text(), storeId))
    } catch (err) {
      setMessage({ tone: "danger", text: domainMessage(err) })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const restore = () => {
    if (!pending) return
    update(() => pending.db)
    setPending(null)
    setMessage({ tone: "info", text: tr("ব্যাকআপ থেকে তথ্য ফেরানো হয়েছে।") })
  }

  return (
    <div className="space-y-3">
      {usage.level !== "ok" ? (
        <Banner tone={usage.level === "danger" ? "danger" : "warn"}>
          {tr("ফোনের সেভ-জায়গা")} {toBanglaDigits(usage.percent)}{tr("% ভরেছে। এখনই ব্যাকআপ নিন; জায়গা শেষ হলে নতুন বিল সেভ নাও হতে পারে।")}
        </Banner>
      ) : (
        <p className="text-sm text-muted">{tr("ফোনের সেভ-জায়গা ব্যবহার:")} {toBanglaDigits(usage.percent)}%</p>
      )}

      {persistent !== true ? (
        <Banner tone="warn">
          {tr("ব্রাউজার এই ডেটা স্থায়ী রাখার নিশ্চয়তা দেয়নি; ফোনের জায়গা কমলে বা অনেক দিন না খুললে মুছে যেতে পারে। অ্যাপটি হোম স্ক্রিনে যোগ করুন আর নিয়মিত ব্যাকআপ নিন।")}
        </Banner>
      ) : null}

      <Button variant="secondary" full onClick={download}>
        {tr("ব্যাকআপ ফাইল নামান")}
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label={tr("ব্যাকআপ ফাইল বাছুন")}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
        }}
      />
      <Button variant="secondary" full onClick={() => fileRef.current?.click()}>
        {tr("ব্যাকআপ থেকে ফেরান")}
      </Button>

      {pending ? (
        <div className="space-y-2 rounded-xl border border-line bg-white p-3 text-sm">
          <p>
            {tr("ব্যাকআপে আছে: পণ্য")} {toBanglaDigits(pending.db.products.length)}{tr("টি, বিল")} {toBanglaDigits(pending.db.sales.length)}{tr("টি, কাস্টমার")} {toBanglaDigits(pending.db.customers.length)}{tr("জন।")}
          </p>
          <p className="text-danger">{tr("ফেরালে এই ফোনের এখনকার সব পণ্য, বিল ও বাকির তথ্য এটি দিয়ে বদলে যাবে।")}</p>
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" onClick={restore}>
              {tr("হ্যাঁ, ফেরান")}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setPending(null)}>
              {tr("বাতিল")}
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
    </div>
  )
}
