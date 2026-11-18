"use client"

import { CrashScreen } from "@/components/crash-screen"

// root layout নিজেই ভাঙলে এটি তার জায়গা নেয়, তাই নিজের html/body লাগে
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="bn">
      <body style={{ margin: 0 }}>
        <CrashScreen onRetry={reset} />
      </body>
    </html>
  )
}
