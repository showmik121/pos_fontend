"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Sheet } from "./ui/sheet"
import { Field } from "./ui/field"
import { toAsciiDigits } from "@/lib/format/bn"

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
}

function detectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

interface ScannerProps {
  open: boolean
  onClose: () => void
  onCode: (code: string) => void
  title?: string
}

/** ক্যামেরায় বারকোড স্ক্যান (ব্রাউজার সাপোর্ট করলে); না করলে বা ক্যামেরা না দিলে হাতে লিখে দেওয়া যায়। */
export function Scanner({ open, onClose, onCode, title = "বারকোড স্ক্যান" }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manual, setManual] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    if (!open) return
    setManual("")
    setNote(null)
    const Ctor = detectorCtor()
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setNote("এই ফোনের ব্রাউজারে ক্যামেরা স্ক্যান চলে না — নম্বর হাতে লিখুন।")
      return
    }
    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0
    const detector = new Ctor()

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const tick = async () => {
          if (stopped) return
          try {
            const found = await detector.detect(video)
            const code = found[0]?.rawValue
            if (code) {
              stopped = true
              onCodeRef.current(code)
              return
            }
          } catch {
            // একটি ফ্রেম ব্যর্থ হলে পরেরটায় চেষ্টা
          }
          timer = window.setTimeout(tick, 250)
        }
        void tick()
      } catch {
        setNote("ক্যামেরা চালু করা যায়নি — অনুমতি দিন, অথবা নম্বর হাতে লিখুন।")
      }
    }
    void start()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open])

  const submit = () => {
    const code = toAsciiDigits(manual).trim()
    if (code) onCode(code)
  }

  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full rounded-xl bg-ink/90 object-cover" />
      {note ? <p className="text-sm text-muted">{note}</p> : <p className="text-sm text-muted">বারকোডটি ফ্রেমের মাঝে ধরুন</p>}
      <Field id="scan-manual" label="অথবা বারকোড নম্বর লিখুন" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          বাতিল
        </Button>
        <Button className="flex-1" onClick={submit} disabled={!manual.trim()}>
          খুঁজুন
        </Button>
      </div>
    </Sheet>
  )
}
