const PATHS = {
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  scan: "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10",
  search: "M5 11a6 6 0 1 0 12 0 6 6 0 1 0-12 0M20 20l-4-4",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8h.01",
  check: "M5 12l4 4 10-10",
  close: "M6 6l12 12M18 6L6 18",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  warning: "M12 4l9 16H3zM12 10v4M12 17v.5",
  share: "M12 16V4M7 9l5-5 5 5M5 14v5h14v-5",
  print: "M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  barcode: "M4 7v10M8 7v10M12 7v10M16 7v10M20 7v10",
  cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4 4 0 0 1 17 18z",
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  )
}
