// Money is integer poisha everywhere; floats never touch it. Taka text typed by an operator is parsed with string maths only.

/** 119900 -> "৳1,199.00" (always two decimals, en-US grouping). */
export function formatBdt(poisha: number): string {
  const neg = poisha < 0
  const abs = Math.abs(Math.trunc(poisha))
  const taka = Math.floor(abs / 100)
  const paisa = String(abs % 100).padStart(2, "0")
  return `${neg ? "-" : ""}৳${taka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${paisa}`
}

/** "1199", "1,199.5", "499.05" -> poisha. null when it is not a plain amount with at most two decimals. */
export function parseTakaToPoisha(text: string): number | null {
  const t = text.trim().replace(/,/g, "")
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(t)
  if (!m) return null
  const poisha = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0")
  return Number.isSafeInteger(poisha) ? poisha : null
}

/** poisha -> text for an input field: 49900 -> "499", 49950 -> "499.50" */
export function poishaToTakaInput(poisha: number): string {
  const taka = Math.floor(poisha / 100)
  const paisa = poisha % 100
  return paisa === 0 ? String(taka) : `${taka}.${String(paisa).padStart(2, "0")}`
}

/** Dhaka has no daylight saving (UTC+6 all year): "2026-03-01T14:30" typed by the operator is 08:30 UTC. null when empty or invalid. */
export function dhakaLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const ms = Date.parse(`${local}:00+06:00`)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** a fresh key for one Record-payment attempt; same key + same body is a safe retry (server-side idempotency) */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID()
}
