// নিচের মেনুর দুই-সুরের আইকন: সক্রিয় হলে হালকা সবুজ ভরাট শরীর, নইলে শুধু রেখা। ২৪×২৪ গ্রিড, রেখা ১.৭৫।
import type { ReactElement } from "react"

export type NavIconName = "home" | "box" | "ledger" | "chart" | "plus"

const ACTIVE_FILL = "#a9d39a"
const ACTIVE_LIGHT = "#fffdf5"

function body(name: NavIconName, active: boolean): ReactElement {
  const f = active ? ACTIVE_FILL : "none"
  const w = active ? ACTIVE_LIGHT : "none"
  switch (name) {
    case "home":
      return (
        <>
          <path d="M5.2 10.4 12 4.6l6.8 5.8v8.3a1 1 0 0 1-1 1H6.2a1 1 0 0 1-1-1z" fill={f} />
          <path d="M2.8 11.2 12 3.4l9.2 7.8" />
          <path d="M10 19.7v-4.5a2 2 0 0 1 4 0v4.5" fill={w} />
        </>
      )
    case "box":
      return (
        <>
          <path d="M3.6 7.9 12 4l8.4 3.9v8.2L12 20l-8.4-3.9z" fill={f} />
          <path d="M3.6 7.9 12 11.9l8.4-4M12 11.9V20M7.8 5.9l8.4 4" />
        </>
      )
    case "ledger":
      return (
        <>
          <path d="M6.2 3.6h11a1.4 1.4 0 0 1 1.4 1.4v14a1.4 1.4 0 0 1-1.4 1.4h-11z" fill={f} />
          <path d="M9.4 3.6v16.8M12.6 8.4h3.4M12.6 12h3.4M12.6 15.6h2" />
        </>
      )
    case "chart":
      return (
        <>
          <path d="M4.6 20.3v-5.8h3.4v5.8zM10.3 20.3V9.4h3.4v10.9zM16 20.3V5.2h3.4v15.1z" fill={f} />
          <path d="M3 20.5h18" />
        </>
      )
    case "plus":
      return <path d="M12 5v14M5 12h14" />
  }
}

export function NavIcon({ name, active = false, size = 24, strokeWidth = 1.75 }: { name: NavIconName; active?: boolean; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {body(name, active)}
    </svg>
  )
}
