import { tr, tf } from "@/lib/i18n"
import { cn } from "@/lib/cn"
import { formatTaka } from "@/lib/domain/money"
import { toBanglaDigits } from "@/lib/format/bn"
import { changePercent } from "@/lib/store/home-stats"
import type { DaySummary } from "@/lib/store/selectors"

/** ছোট চার্টের বারের সর্বোচ্চ ও সর্বনিম্ন উচ্চতা (px) */
const BAR_MAX_PX = 44
const BAR_MIN_PX = 4

function DeltaChip({ percent }: { percent: number }) {
  const text = percent > 0 ? tf("গতকালের চেয়ে {p0}% বেশি", { p0: toBanglaDigits(percent) }) : percent < 0 ? tf("গতকালের চেয়ে {p0}% কম", { p0: toBanglaDigits(-percent) }) : tr("গতকালের সমান")
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/55 py-1 pl-2 pr-3 text-[12.5px] font-bold text-brand-dark">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn(percent < 0 && "scale-y-[-1]")}>
        <path d="M4 15l5-5 3.4 3.4L20 6M15 6h5v5" />
      </svg>
      {text}
    </div>
  )
}

function Trend({ totals }: { totals: number[] }) {
  const max = Math.max(...totals, 1)
  return (
    <div className="flex flex-none flex-col items-end gap-1.5" aria-hidden="true">
      <div className="flex h-[46px] items-end gap-[5px]">
        {totals.map((t, i) => (
          <span
            key={i}
            className={cn("w-[9px] rounded-[3px]", i === totals.length - 1 ? "bg-brand" : "bg-brand-dark/25")}
            style={{ height: Math.max(BAR_MIN_PX, Math.round((t / max) * BAR_MAX_PX)) }}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-ink2">{tr("গত ৭ দিন")}</span>
    </div>
  )
}

function Split({ label, value, first }: { label: string; value: number; first?: boolean }) {
  return (
    <div className={cn("min-w-0", !first && "border-l border-ink/15 pl-3")}>
      <div className="text-[11.5px] font-medium text-ink2">{label}</div>
      <div className="truncate text-[15px] font-extrabold">{formatTaka(value)}</div>
    </div>
  )
}

/** আজকের বিক্রি: মোট, গতকালের তুলনা, ৭ দিনের চার্ট, নগদ/মোবাইল/বাকির ভাগ */
export function TodayCard({ summary, yesterdayTotal, totals }: { summary: DaySummary; yesterdayTotal: number; totals: number[] }) {
  const percent = changePercent(summary.total, yesterdayTotal)
  return (
    <section className="hero-card rounded-3xl px-4 pb-3.5 pt-4" aria-label={tr("আজকের সারসংক্ষেপ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink2">{tr("আজকের বিক্রি")}</div>
          <div className="mt-0.5 truncate text-[34px] font-extrabold leading-tight tracking-tight">{formatTaka(summary.total)}</div>
          {percent !== null ? <DeltaChip percent={percent} /> : null}
        </div>
        <Trend totals={totals} />
      </div>
      <div className="mt-3.5 grid grid-cols-3 border-t border-ink/15 pt-3">
        <Split first label={tr("নগদ")} value={summary.cash} />
        <Split label={tr("মোবাইল")} value={summary.mobile} />
        <Split label={tr("বাকি")} value={summary.due} />
      </div>
      <div className="mt-2.5 text-xs font-semibold text-ink2">{tf("{p0}টি বিল", { p0: toBanglaDigits(summary.bills) })}</div>
    </section>
  )
}
