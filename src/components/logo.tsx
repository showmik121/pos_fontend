/** অ্যাপের নাম এক জায়গায়; নাম ঠিক হলে শুধু এটি বদলাবে */
export const APP_NAME = "Bipone"

/** লোগো-চিহ্ন (ব্যাগ + শাপলা) ও নাম */
export function Logo({ size = 56 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="block shrink-0 rounded-[22%] shadow-md ring-1 ring-black/5"
        style={{ width: size, height: size, background: 'url("/icons/logo.svg") center / cover no-repeat' }}
      />
      <div className="leading-tight">
        <div className="text-xl font-extrabold tracking-tight text-ink">{APP_NAME}</div>
        <div className="text-xs text-muted">দোকানের বিক্রি · স্টক · বাকি</div>
      </div>
    </div>
  )
}
