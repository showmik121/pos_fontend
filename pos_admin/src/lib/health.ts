// Small pure helpers for the A2 pages (unit-tested in tests/health.test.ts).
import type { ErrorStatus } from "@/contract/admin-api"

export type HealthTab = "sync" | "errors" | "negative"
export const HEALTH_TABS: ReadonlyArray<{ id: HealthTab; label: string }> = [
  { id: "sync", label: "Stuck sync" },
  { id: "errors", label: "App errors" },
  { id: "negative", label: "Negative stock" },
]

/** ?tab= from the URL; anything unknown falls back to the first tab instead of crashing */
export function parseTab(raw: string | null | undefined): HealthTab {
  return HEALTH_TABS.find((t) => t.id === raw)?.id ?? "sync"
}

/** 5 -> "5 h", 24 -> "1 day", 30 -> "1 day 6 h", 49 -> "2 days 1 h" */
export function formatHours(hours: number): string {
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  const d = days === 1 ? "1 day" : `${days} days`
  return rest === 0 ? d : `${d} ${rest} h`
}

export const ERROR_STATUS_LABEL: Record<ErrorStatus, string> = { open: "Open", resolved: "Resolved", ignored: "Ignored" }
