"use client"

import { tr } from "@/lib/i18n"
import { hasStrips, packChoices } from "@/lib/store/pack-text"
import type { Product } from "@/lib/store/types"
import { Button } from "./ui/button"

export function PackQuickAdd({ product, includeOne = false, onAdd, className }: { product: Product; includeOne?: boolean; onAdd: (pieces: number) => void; className?: string }) {
  if (!hasStrips(product)) return null
  return (
    <div className={className ?? "flex flex-wrap gap-2"} role="group" aria-label={tr("পাতা বা পিস যোগ করুন")}>
      {packChoices(product, includeOne).map((c) => (
        <Button key={c.qty} variant="secondary" className="min-h-11 px-3 text-sm" onClick={() => onAdd(c.qty)}>
          +{c.label}
        </Button>
      ))}
    </div>
  )
}
