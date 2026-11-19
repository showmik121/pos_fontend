"use client"

import { CrashScreen } from "@/components/crash-screen"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CrashScreen onRetry={reset} error={error} />
}
