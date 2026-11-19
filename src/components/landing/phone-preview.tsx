/** ল্যান্ডিংয়ের ফোন-নমুনা: অ্যাপের হোম পাতার ছোট প্রতিচ্ছবি (শুধু সাজ, নমুনা তথ্য) */

const ROWS = [
  { dot: "bg-danger", title: "স্টক কম", sub: "৩টি পণ্য" },
  { dot: "bg-gold", title: "মেয়াদ কাছে", sub: "৩০ দিনের মধ্যে ২টি ব্যাচ" },
  { dot: "bg-gold", title: "বাকি", sub: "৩ জনের কাছে ৳ ৫,৫০০" },
] as const

const TABS = ["হোম", "বিল", "স্টক", "বাকি", "রিপোর্ট"] as const

export function PhonePreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-[17.5rem] select-none">
      <div className="absolute -inset-6 rounded-[3rem] bg-gold/25 blur-2xl" />
      <div className="relative overflow-hidden rounded-[2.4rem] border-[7px] border-ink bg-canvas shadow-[0_30px_60px_-20px_rgb(107_68_35/0.55)]">
        <div className="mx-auto mt-2 h-4 w-20 rounded-full bg-ink" />
        <div className="space-y-3 px-3.5 pb-3 pt-3">
          <div className="text-[13px] font-bold text-ink">রহিমা ফার্মেসি</div>
          <div className="btn-primary-grad grid min-h-10 place-items-center rounded-xl text-[13px] font-semibold text-white">+ নতুন বিল</div>
          <div className="hero-card rounded-2xl px-3.5 py-3">
            <div className="text-[11px] font-medium text-ink/70">আজকের বিক্রি</div>
            <div className="text-[26px] font-extrabold leading-tight tracking-tight">৳ ৮,৫০০</div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/45 px-2.5 py-0.5 text-[11px] font-medium">
              <span className="size-1.5 rounded-full bg-brand" />
              ১২টি বিল
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
            <span className="h-3.5 w-1 rounded-full bg-gold" />
            নজর দিন
          </div>
          <div className="card-surface divide-y divide-line rounded-xl border border-line bg-white">
            {ROWS.map((r) => (
              <div key={r.title} className="flex items-center gap-2.5 px-3 py-2">
                <span className={`size-2 rounded-full ${r.dot}`} />
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-ink">{r.title}</div>
                  <div className="truncate text-[10.5px] text-muted">{r.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex justify-around border-t border-line bg-white px-1 pb-2 pt-2.5">
          <span className="absolute inset-x-5 top-0 h-[3px] w-10 rounded-b-full bg-gold" />
          {TABS.map((t, i) => (
            <span key={t} className={i === 0 ? "text-[10px] font-bold text-brand" : "text-[10px] text-muted"}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
