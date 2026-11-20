// Display helpers. Timestamps arrive as ISO-8601 UTC and are always shown in Asia/Dhaka, whatever the operator's browser zone is.
const DHAKA = "Asia/Dhaka"

const dateTime = new Intl.DateTimeFormat("en-GB", { timeZone: DHAKA, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })

export function formatDhaka(iso: string | null | undefined): string {
  if (!iso) return "—"
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return "—"
  const parts = Object.fromEntries(dateTime.formatToParts(new Date(t)).map((p) => [p.type, p.value]))
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()}`
}

export function formatRelative(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return "Never"
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return "—"
  const secs = Math.max(0, Math.round((nowMs - t) / 1000))
  if (secs < 60) return "Just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}
