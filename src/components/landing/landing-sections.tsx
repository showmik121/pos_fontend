import Link from "next/link"
import { Logo } from "@/components/logo"
import { SHOP_KIND_OPTIONS } from "@/components/shop-kind-picker"
import { Icon } from "@/components/ui/icons"
import { tr } from "@/lib/i18n"
import { FEATURES, STEPS } from "./landing-content"

/** সেকশনের শিরোনাম: ছোট সোনালি লেবেল + বড় শিরোনাম + ঐচ্ছিক উপশিরোনাম */
function SectionHead({ id, eyebrow, title, sub, center = false }: { id: string; eyebrow: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <span className="text-[13px] font-bold uppercase tracking-wide text-warn">{tr(eyebrow)}</span>
      <h2 id={id} className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-ink md:text-4xl">
        {tr(title)}
      </h2>
      {sub ? <p className="mt-3 text-[16px] leading-relaxed text-ink2">{tr(sub)}</p> : null}
    </div>
  )
}

/** তিন ধরনের দোকান: সাইন-আপের একই চিত্র ও লেখা */
export function ShopTypes() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20" aria-labelledby="kinds-title">
      <SectionHead id="kinds-title" eyebrow="দোকানের ধরন" title="আপনার দোকান যে ধরনেরই হোক" sub="ফার্মেসি, কসমেটিক্স বা অন্য যেকোনো দোকান — শুরুতে নিজের ধরন বেছে নিন।" center />
      <ul className="mt-9 grid gap-4 md:grid-cols-3 md:gap-6">
        {SHOP_KIND_OPTIONS.map((o) => (
          <li key={o.value} className="card-surface flex items-center gap-4 rounded-3xl border border-line bg-white p-4 md:flex-col md:items-start md:gap-5 md:p-6">
            <span className={`grid size-20 flex-none place-items-center rounded-3xl bg-gradient-to-br md:size-28 [&>svg]:size-[4.4rem] md:[&>svg]:size-24 ${o.tile}`}>{o.art}</span>
            <div>
              <h3 className="text-[19px] font-bold text-ink">{tr(o.label)}</h3>
              <p className="mt-1 text-[14.5px] leading-snug text-ink2">{tr(o.hint)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-y border-line bg-white" aria-labelledby="features-title">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <SectionHead id="features-title" eyebrow="সুবিধা" title="দোকান চালাতে যা যা লাগে" sub="ফার্মেসি আর কসমেটিক্স দোকানের রোজকার কাজ ধরে বানানো।" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((f) => (
            <li key={f.title} className="card-surface flex items-start gap-4 rounded-3xl border border-line bg-canvas p-5 transition-transform duration-200 hover:-translate-y-0.5 sm:block sm:p-6">
              <span className="btn-primary-grad grid size-11 flex-none place-items-center rounded-2xl text-white sm:size-12">
                <Icon name={f.icon} size={24} />
              </span>
              <div>
                <h3 className="text-[17px] font-bold text-ink sm:mt-5 sm:text-[18px]">{tr(f.title)}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink2 sm:text-[15px]">{tr(f.body)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function Steps() {
  return (
    <section id="steps" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 md:py-20" aria-labelledby="steps-title">
      <SectionHead id="steps-title" eyebrow="শুরুর ধাপ" title="তিন ধাপেই শুরু" center />
      <ol className="mt-10 grid gap-5 md:grid-cols-3 md:gap-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 md:block">
            {i < STEPS.length - 1 ? <span aria-hidden="true" className="absolute left-[19px] top-12 h-[calc(100%-1.5rem)] w-px bg-line-strong md:left-14 md:top-5 md:h-px md:w-[calc(100%-3rem)] md:bg-gradient-to-r md:from-line-strong md:to-transparent" /> : null}
            <span aria-hidden="true" className="relative z-10 grid size-10 flex-none place-items-center rounded-full bg-gold text-[16px] font-extrabold text-ink shadow-sm">
              {[tr("১"), tr("২"), tr("৩")][i]}
            </span>
            <div className="pb-2 md:mt-5">
              <h3 className="text-[18px] font-bold text-ink">{tr(s.title)}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink2">{tr(s.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** শেষে গাঢ় সবুজ আহ্বান-ব্যান্ড */
export function CtaBand() {
  return (
    <section className="px-4 pb-14 sm:px-6 md:pb-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand to-brand-dark px-6 py-12 text-center text-white md:py-16">
        <div aria-hidden="true" className="absolute -right-16 -top-16 size-64 rounded-full border-[36px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-10 size-72 rounded-full bg-gold/15 blur-2xl" />
        <h2 className="relative mx-auto max-w-2xl text-[26px] font-extrabold leading-tight tracking-tight md:text-4xl">{tr("আজই আপনার দোকানের খাতা ফোনে তুলুন")}</h2>
        <p className="relative mx-auto mt-3 max-w-md text-[16px] text-white/85">{tr("নাম আর মোবাইল নম্বর দিলেই দোকান তৈরি।")}</p>
        <Link href="/signup" className="relative mt-7 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gold px-9 text-base font-bold text-ink shadow-lg shadow-black/20 active:bg-[#d98a00]">
          {tr("দোকান খুলুন")}
          <Icon name="chevron" size={18} />
        </Link>
      </div>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <Logo size={40} />
        <nav aria-label={tr("ফুটার মেনু")} className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium text-ink2">
          <a href="#features" className="hover:text-brand-dark">{tr("সুবিধা")}</a>
          <a href="#steps" className="hover:text-brand-dark">{tr("শুরুর ধাপ")}</a>
          <a href="#install" className="hover:text-brand-dark">{tr("ইনস্টল")}</a>
          <Link href="/login" className="hover:text-brand-dark">{tr("লগইন")}</Link>
          <Link href="/signup" className="hover:text-brand-dark">{tr("দোকান খুলুন")}</Link>
        </nav>
      </div>
      <div className="border-t border-line py-4 text-center text-[13px] text-muted">{tr("© Bipone — ফার্মেসি ও কসমেটিক্স দোকানের জন্য")}</div>
    </footer>
  )
}
