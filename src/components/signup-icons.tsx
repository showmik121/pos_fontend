/** দোকান-খোলার ফর্মের ছোট রেখা-আইকন (বাইরের ছবি নেই) */
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const

export const StoreIcon = () => (
  <svg {...base}>
    <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5M5.5 12v8h13v-8M10 20v-4.5h4V20" />
  </svg>
)
export const PersonIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" />
  </svg>
)
export const PhoneIcon = () => (
  <svg {...base}>
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M11 17.5h2" />
  </svg>
)
export const LockIcon = () => (
  <svg {...base}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
)
export const PillIcon = () => (
  <svg {...base} width={26} height={26}>
    <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" />
    <path d="m9.2 7.9 6.9 6.9" transform="rotate(0 12 12)" />
  </svg>
)
export const BagIcon = () => (
  <svg {...base} width={26} height={26}>
    <path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
)
export const CosmeticsIcon = () => (
  <svg {...base} width={26} height={26}>
    <path d="M9 21v-7h6v7zM10 14V9.5l2.5-5L15 9.5V14M18.5 4v3M17 5.5h3" />
  </svg>
)
