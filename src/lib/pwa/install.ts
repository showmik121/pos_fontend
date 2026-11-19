/** Chrome/Edge/Android-এর ইনস্টল ইভেন্ট (সব ব্রাউজারে নেই, তাই টাইপ নিজে লেখা) */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export const DISMISS_KEY = "pos.install.dismissed.v1"
/** "পরে" চাপলে এতদিন আর দেখাবে না */
export const DISMISS_DAYS = 14
const DAY_MS = 86_400_000

/** iPhone/iPad-এর Safari কি না (অন্য ব্রাউজারে "Add to Home Screen" এভাবে নেই) */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (userAgent.includes("Mac") && maxTouchPoints > 1)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)
  return ios && !otherBrowser
}

/** সংরক্ষিত "পরে"-র সময় থেকে বলে এখনো লুকিয়ে রাখতে হবে কি না */
export function isDismissedRecently(stored: string | null, now: number): boolean {
  const at = Number(stored)
  return Number.isFinite(at) && at > 0 && now - at < DISMISS_DAYS * DAY_MS
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

// ব্রাউজার ইভেন্টটি একবারই ছোঁড়ে, পাতা লোডের শুরুতে; কম্পোনেন্ট বসার আগে এলেও যেন হারিয়ে না যায়
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    notify()
  })
}

export function getInstallEvent(): InstallPromptEvent | null {
  return deferred
}

export function clearInstallEvent(): void {
  deferred = null
  notify()
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
