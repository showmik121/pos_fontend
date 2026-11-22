/**
 * দোকানের ধরনের সফট-3D ইলাস্ট্রেশন (ভেক্টর, বাইরের ছবি নেই)।
 * ৬৪×৬৪ ক্যানভাস; প্রতিটিতে নরম ছায়া, গ্রেডিয়েন্ট বডি ও ওপরের হাইলাইট।
 * গ্রেডিয়েন্ট id প্রতিটি আর্টে আলাদা, তাই একই পাতায় দুবার বসালেও ধাক্কা লাগে না।
 */
const svgProps = { viewBox: "0 0 64 64", width: 64, height: 64, fill: "none", "aria-hidden": true, focusable: false } as const

/** ফার্মেসি: ওষুধের বোতল + ক্যাপসুল */
export function PharmacyArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="ph-body" x1="17" y1="16" x2="47" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4C9A5C" />
          <stop offset="1" stopColor="#1F5A2E" />
        </linearGradient>
        <linearGradient id="ph-cap" x1="20" y1="8" x2="44" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC83D" />
          <stop offset="1" stopColor="#E09400" />
        </linearGradient>
        <linearGradient id="ph-pill-a" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFD15C" />
          <stop offset="1" stopColor="#E59A00" />
        </linearGradient>
        <linearGradient id="ph-pill-b" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCE8D8" />
        </linearGradient>
        <radialGradient id="ph-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#2A2315" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2A2315" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="24" ry="4.2" fill="url(#ph-shadow)" />
      {/* বোতল */}
      <rect x="17" y="17" width="30" height="40" rx="8.5" fill="url(#ph-body)" />
      <rect x="21" y="20" width="4" height="33" rx="2" fill="#fff" opacity="0.2" />
      <rect x="20" y="8" width="24" height="11" rx="4" fill="url(#ph-cap)" />
      <rect x="23" y="10" width="18" height="2.4" rx="1.2" fill="#fff" opacity="0.45" />
      {/* লেবেল + ক্রস */}
      <rect x="22" y="29" width="20" height="18" rx="4" fill="#fff" />
      <rect x="30" y="32" width="4" height="12" rx="1.4" fill="#2E6B3A" />
      <rect x="26" y="36" width="12" height="4" rx="1.4" fill="#2E6B3A" />
      {/* ক্যাপসুল */}
      <g transform="rotate(-38 47 49)">
        <rect x="35" y="43.5" width="24" height="11" rx="5.5" fill="url(#ph-pill-b)" />
        <path d="M47 43.5h.5v11H47z" fill="#C9D8C4" />
        <path d="M40.5 43.5H47v11h-6.5a5.5 5.5 0 0 1 0-11Z" fill="url(#ph-pill-a)" />
        <rect x="38" y="45" width="17" height="2" rx="1" fill="#fff" opacity="0.5" />
      </g>
    </svg>
  )
}

/** কসমেটিক্স: লিপস্টিক + কম্প্যাক্ট + ঝিলিক */
export function CosmeticsArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="co-bullet" x1="26" y1="10" x2="42" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0708F" />
          <stop offset="1" stopColor="#B72D58" />
        </linearGradient>
        <linearGradient id="co-gold" x1="24" y1="30" x2="42" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD460" />
          <stop offset="1" stopColor="#D78A00" />
        </linearGradient>
        <linearGradient id="co-compact" x1="6" y1="32" x2="30" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F9A3B6" />
          <stop offset="1" stopColor="#D8456E" />
        </linearGradient>
        <linearGradient id="co-mirror" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F6D3DC" />
        </linearGradient>
        <radialGradient id="co-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#2A2315" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2A2315" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="25" ry="4.2" fill="url(#co-shadow)" />
      {/* কম্প্যাক্ট */}
      <circle cx="19" cy="44" r="13" fill="url(#co-compact)" />
      <circle cx="19" cy="44" r="8.6" fill="url(#co-mirror)" />
      <path d="M13.5 41.5a6.6 6.6 0 0 1 4.6-3.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <rect x="9" y="33" width="2.4" height="8" rx="1.2" transform="rotate(-48 10.2 37)" fill="#fff" opacity="0.35" />
      {/* লিপস্টিক */}
      <rect x="29" y="35" width="17" height="21" rx="4" fill="url(#co-gold)" />
      <rect x="31.5" y="37" width="3" height="17" rx="1.5" fill="#fff" opacity="0.35" />
      <rect x="27.5" y="28" width="20" height="9" rx="3" fill="#2A2315" />
      <rect x="29.5" y="29.5" width="16" height="2" rx="1" fill="#fff" opacity="0.22" />
      <path d="M31 28V19.5c0-1.3.5-2.5 1.4-3.4l4.2-4.3a2 2 0 0 1 3.4 1.4V28Z" fill="url(#co-bullet)" />
      <path d="M33.4 27V20.4c0-.7.3-1.4.8-1.9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      {/* ঝিলিক */}
      <path d="m52 9 1.9 4.6 4.6 1.9-4.6 1.9L52 22l-1.9-4.6-4.6-1.9 4.6-1.9Z" fill="#FFC83D" />
      <path d="m57.5 27 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" fill="#F0708F" />
    </svg>
  )
}

/** রিটেইল: শপিং ব্যাগ + প্রাইস ট্যাগ */
export function RetailArt() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="re-bag" x1="14" y1="24" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC63A" />
          <stop offset="1" stopColor="#E08A00" />
        </linearGradient>
        <linearGradient id="re-fold" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#B96E00" stopOpacity="0.55" />
          <stop offset="1" stopColor="#B96E00" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="re-tag" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCE8D8" />
        </linearGradient>
        <radialGradient id="re-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#2A2315" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2A2315" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="24" ry="4.2" fill="url(#re-shadow)" />
      {/* হাতল */}
      <path d="M23 26v-7a9 9 0 0 1 18 0v7" stroke="#2E6B3A" strokeWidth="4" strokeLinecap="round" />
      <path d="M23 26v-7a9 9 0 0 1 4-7.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" />
      {/* ব্যাগ */}
      <path d="M12 24h40l3 28a6 6 0 0 1-6 6.6H15a6 6 0 0 1-6-6.6Z" fill="url(#re-bag)" />
      <path d="M12 24h40l.5 4.6H11.5Z" fill="url(#re-fold)" />
      <path d="M15 30c-.4 8-.3 16 .4 24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" />
      <circle cx="23" cy="25" r="2" fill="#7A4A06" opacity="0.55" />
      <circle cx="41" cy="25" r="2" fill="#7A4A06" opacity="0.55" />
      {/* ট্যাগ */}
      <g transform="rotate(14 44 46)">
        <path d="M33 38h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H33a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3Z" fill="url(#re-tag)" />
        <circle cx="34.5" cy="42.5" r="1.6" fill="#E09400" />
        <rect x="38" y="42" width="8" height="2.2" rx="1.1" fill="#2E6B3A" />
        <rect x="34" y="47.2" width="12" height="2.2" rx="1.1" fill="#CFC39C" />
      </g>
    </svg>
  )
}
