"use client"

import { tr } from "@/lib/i18n"
import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Sheet } from "./ui/sheet"
import { Field } from "./ui/field"
import { toAsciiDigits } from "@/lib/format/bn"
import { buildVideoConstraints, focusConstraint, pickFormats, torchSupported, zoomRange } from "@/lib/scan/camera-config"

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}
type VideoWithFrameCallback = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (id: number) => void }

function detectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

interface ScannerProps {
  open: boolean
  onClose: () => void
  /** continuous হলে ফেরত দেওয়া লেখা স্ক্যানারের ভেতরে দেখায় (যেমন "✓ পন্ডস ক্রিম যোগ হলো") */
  onCode: (code: string) => string | void
  title?: string
  /** true হলে একটি স্ক্যানের পরও ক্যামেরা খোলা থাকে, একটানা অনেক পণ্য স্ক্যান করা যায় */
  continuous?: boolean
}

/** একই বারকোড ক্যামেরার সামনে ধরে রাখলে বারবার না ধরার বিরতি */
const SAME_CODE_PAUSE_MS = 1500
/** torch/zoom/focusMode এখনো TypeScript-এর টাইপে নেই; ডিভাইস না পারলে ত্রুটি ছোঁড়ে */
function applyAdvanced(track: MediaStreamTrack | null | undefined, set: Record<string, unknown>): Promise<void> {
  if (!track) return Promise.resolve()
  return track.applyConstraints({ advanced: [set] } as unknown as MediaTrackConstraints)
}

/** ফ্রেম-কলব্যাক না থাকলে পরীক্ষার বিরতি (আগে ২৫০ms ছিল; কম বিরতিতে ধরা দ্রুত হয়) */
const FALLBACK_TICK_MS = 120

/** ক্যামেরায় বারকোড স্ক্যান (ব্রাউজার সাপোর্ট করলে); না করলে বা ক্যামেরা না দিলে হাতে লিখে দেওয়া যায়। */
export function Scanner({ open, onClose, onCode, title = tr("বারকোড স্ক্যান"), continuous = false }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manual, setManual] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  // ক্যামেরার সুবিধা: টর্চ ও জুম শুধু যে ফোনে আছে সেখানে দেখায়
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false })
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    if (!open) return
    setManual("")
    setNote(null)
    setFeedback(null)
    setCount(0)
    setTorch({ supported: false, on: false })
    setZoom(null)
    const Ctor = detectorCtor()
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setNote(tr("এই ফোনের ব্রাউজারে ক্যামেরা স্ক্যান চলে না — নম্বর হাতে লিখুন।"))
      return
    }
    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0
    let frameId = 0
    let videoEl: VideoWithFrameCallback | null = null
    let last = { code: "", at: 0 }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: buildVideoConstraints(), audio: false })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video: VideoWithFrameCallback | null = videoRef.current
        if (!video) return
        videoEl = video
        const supported = await Ctor.getSupportedFormats?.().catch(() => undefined)
        const detector = new Ctor({ formats: pickFormats(supported) })
        const track = stream.getVideoTracks()[0] ?? null
        trackRef.current = track
        // সব ফোনে এই সুবিধা নেই; না থাকলে চুপচাপ বাদ
        const caps = (track?.getCapabilities?.() ?? {}) as Parameters<typeof focusConstraint>[0]
        const focus = focusConstraint(caps)
        if (focus) await applyAdvanced(track, focus).catch(() => undefined)
        setTorch({ supported: torchSupported(caps), on: false })
        const zr = zoomRange(caps)
        setZoom(zr ? { ...zr, value: zr.min } : null)
        video.srcObject = stream
        await video.play()
        const tick = async () => {
          if (stopped) return
          try {
            const found = await detector.detect(video)
            const code = found[0]?.rawValue
            if (code && !continuous) {
              stopped = true
              onCodeRef.current(code)
              return
            }
            if (code && !(code === last.code && Date.now() - last.at < SAME_CODE_PAUSE_MS)) {
              last = { code, at: Date.now() }
              const msg = onCodeRef.current(code)
              setFeedback(typeof msg === "string" ? msg : null)
              setCount((n) => n + 1)
              navigator.vibrate?.(60)
            } else if (code) {
              last = { code, at: Date.now() }
            }
          } catch {
            // একটি ফ্রেম ব্যর্থ হলে পরেরটায় চেষ্টা
          }
          schedule()
        }
        const schedule = () => {
          if (stopped) return
          if (video.requestVideoFrameCallback) frameId = video.requestVideoFrameCallback(() => void tick())
          else timer = window.setTimeout(() => void tick(), FALLBACK_TICK_MS)
        }
        void tick()
      } catch {
        setNote(tr("ক্যামেরা চালু করা যায়নি — অনুমতি দিন, অথবা নম্বর হাতে লিখুন।"))
      }
    }
    void start()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      if (frameId && videoEl?.cancelVideoFrameCallback) videoEl.cancelVideoFrameCallback(frameId)
      trackRef.current = null
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, continuous])

  const toggleTorch = async () => {
    const on = !torch.on
    try {
      await applyAdvanced(trackRef.current, { torch: on })
      setTorch({ supported: true, on })
    } catch {
      setTorch({ supported: false, on: false })
    }
  }

  const changeZoom = async (value: number) => {
    setZoom((z) => (z ? { ...z, value } : z))
    await applyAdvanced(trackRef.current, { zoom: value }).catch(() => undefined)
  }

  const submit = () => {
    const code = toAsciiDigits(manual).trim()
    if (!code) return
    const msg = onCode(code)
    if (continuous) {
      setFeedback(typeof msg === "string" ? msg : null)
      setCount((n) => n + 1)
      setManual("")
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="relative">
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full rounded-xl bg-ink/90 object-cover" />
        {/* লক্ষ্য-ফ্রেম: বারকোড এর ভেতরে ধরলে ভালো পড়ে */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] inset-y-[24%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
        {torch.supported ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torch.on}
            className="absolute right-2 top-2 min-h-11 rounded-full bg-black/55 px-4 text-sm font-semibold text-white active:bg-black/75"
          >
            {torch.on ? tr("টর্চ বন্ধ") : tr("টর্চ জ্বালুন")}
          </button>
        ) : null}
      </div>
      {zoom ? (
        <label className="flex items-center gap-3 text-sm font-medium">
          <span className="shrink-0">{tr("জুম")}</span>
          <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={(e) => void changeZoom(Number(e.target.value))} className="min-h-11 w-full" />
        </label>
      ) : null}
      {continuous && feedback ? (
        <p role="status" className="rounded-xl bg-brand-soft px-3 py-2 text-[15px] font-medium text-brand-dark">
          {feedback}
        </p>
      ) : null}
      {note ? <p className="text-sm text-muted">{note}</p> : <p className="text-sm text-muted">{continuous ? tr("একটার পর একটা বারকোড ধরুন — বিলে যোগ হতে থাকবে") : tr("বারকোডটি ফ্রেমের মাঝে ধরুন")}</p>}
      <Field id="scan-manual" label={tr("অথবা বারকোড নম্বর লিখুন")} inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          {continuous ? (count > 0 ? tr("শেষ করুন") : tr("বন্ধ")) : tr("বাতিল")}
        </Button>
        <Button className="flex-1" onClick={submit} disabled={!manual.trim()}>
          {continuous ? tr("যোগ করুন") : tr("খুঁজুন")}
        </Button>
      </div>
    </Sheet>
  )
}
