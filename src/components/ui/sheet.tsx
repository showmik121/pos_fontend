"use client"

import { useEffect, type ReactNode } from "react"

/** নিচ থেকে ওঠা পর্দা (বটম শিট)। বাইরে চাপলে বা Esc দিলে বন্ধ হয়। */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/55" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-(--app-col) space-y-3 overflow-y-auto rounded-t-[20px] bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
        {children}
      </div>
    </div>
  )
}
