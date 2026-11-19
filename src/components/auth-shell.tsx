import type { ReactNode } from "react"
import { Logo } from "./logo"

interface AuthShellProps {
  title: string
  subtitle: string
  /** ফর্মের নিচের লিংক */
  footer: ReactNode
  children: ReactNode
}

/** লগইন ও দোকান-খোলার পাতার কাঠামো: ব্র্যান্ড, কার্ডে ফর্ম, নিচে শহর-দৃশ্য */
export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-canvas">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-gold/35 to-transparent" />
      <div className="relative mx-auto w-full max-w-md flex-1 px-5 pb-6 pt-8">
        <div className="mb-7">
          <Logo />
        </div>
        <div className="card-surface rounded-3xl border border-line bg-white p-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
      <div className="app-skyline relative mx-auto max-w-md opacity-90" aria-hidden="true" />
    </main>
  )
}
