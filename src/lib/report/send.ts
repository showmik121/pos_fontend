import { apiBaseUrl } from "../api/client"
import { buildReport, fingerprintOf, shouldSend, type CrashKind } from "./crash-report"

const APP_VERSION = (process.env.NEXT_PUBLIC_APP_VERSION || "dev").slice(0, 40)

function sessionStore(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * ক্র্যাশ নিজের সার্ভারে জানায় (বাইরের সেবায় নয়)। কখনো ছোঁড়ে না, ব্যর্থ হলে চুপ থাকে:
 * ক্র্যাশ-রিপোর্টের ভুলে যেন আরেকটি ক্র্যাশ না হয়। লগইন টোকেন পাঠানো হয় না।
 */
export function reportCrash(kind: CrashKind, err: unknown): void {
  try {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return
    const report = buildReport(kind, err, { path: window.location.pathname, appVersion: APP_VERSION })
    if (!shouldSend(fingerprintOf(report), sessionStore(), Date.now())) return
    void fetch(`${apiBaseUrl()}/v1/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {
      // অফলাইন বা সার্ভার সমস্যা: রিপোর্ট হারালেও অ্যাপ চলবে
    })
  } catch {
    // রিপোর্টার কখনো অ্যাপ ভাঙবে না
  }
}
