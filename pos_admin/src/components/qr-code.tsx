import { useMemo } from "react"
import { encodeQr } from "@/lib/qr"

const QUIET_ZONE = 4

/**
 * Renders `value` as an inline SVG QR code. Attribute-only markup (no inline styles) so it works under the strict CSP.
 * Dark modules are merged into one path; the white background is part of the SVG so it scans in dark mode too.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { path, size } = useMemo(() => {
    const m = encodeQr(value)
    const n = m.length
    const cmds: string[] = []
    m.forEach((row, y) => {
      let x = 0
      while (x < n) {
        if (!row[x]) {
          x++
          continue
        }
        const start = x
        while (x < n && row[x]) x++
        cmds.push(`M${start + QUIET_ZONE} ${y + QUIET_ZONE}h${x - start}v1h-${x - start}z`)
      }
    })
    return { path: cmds.join(""), size: n + QUIET_ZONE * 2 }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      width="208"
      height="208"
      shapeRendering="crispEdges"
      className="rounded border border-[var(--line)]"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
