import { AppShell } from "./app-shell"

export function ComingSoon({ title, step, note }: { title: string; step: string; note: string }) {
  return (
    <AppShell title={title}>
      <div className="rounded-2xl border border-line bg-white p-5 text-center">
        <p className="text-base font-medium text-ink">এই পর্দা এখনো তৈরি হয়নি</p>
        <p className="mt-1 text-sm text-muted">{note}</p>
        <p className="mt-3 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-dark">পরিকল্পনা: {step}</p>
      </div>
    </AppShell>
  )
}
