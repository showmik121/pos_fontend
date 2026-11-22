import { Icon, type IconName } from "@/components/ui/icons"
import { LinkButton } from "@/components/ui/button"
import { tr } from "@/lib/i18n"
import { InstallButton } from "./install-section"
import { HERO, TRUST_POINTS } from "./landing-content"
import { PhonePreview } from "./phone-preview"

const TRUST_ICONS: readonly IconName[] = ["users", "download", "offline"]

/** হিরো: বাঁয়ে বার্তা ও বোতাম, ডানে ফোনের নমুনা (মোবাইলে ফোন নিচে, নিচের অংশ ঝাপসা করে ছাঁটা) */
export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(60rem_30rem_at_90%_-10%,rgb(242_169_0/0.24),transparent_60%),radial-gradient(40rem_24rem_at_-10%_30%,rgb(46_107_58/0.10),transparent_60%)]">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-0 pt-9 sm:px-6 md:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-20 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3 py-1 text-[13px] font-semibold text-warn">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
            {tr(HERO.eyebrow)}
          </span>
          <h1 className="mt-4 text-[36px] font-extrabold leading-[1.18] tracking-tight text-ink sm:text-5xl lg:text-[56px] lg:leading-[1.12]">
            {tr("দোকানের হিসাব,")}{" "}
            <span className="whitespace-nowrap text-brand [background:linear-gradient(transparent_64%,#ffd966_64%,#ffd966_92%,transparent_92%)]">{tr("এখন ফোনেই")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-ink2 lg:text-lg">{tr(HERO.lead)}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/signup" className="min-h-14 px-8 text-base shadow-lg sm:min-w-52">
              {tr("দোকান খুলুন")}
              <Icon name="chevron" size={18} />
            </LinkButton>
            <LinkButton href="/login" variant="secondary" className="min-h-14 px-8 text-base sm:min-w-36">
              {tr("লগইন")}
            </LinkButton>
          </div>
          <InstallButton variant="secondary" className="mt-3 min-h-12 w-full sm:hidden" />

          <ul className="mt-7 grid gap-2.5 text-[14px] font-medium text-ink2 sm:flex sm:flex-wrap sm:gap-x-6">
            {TRUST_POINTS.map((t, i) => (
              <li key={t} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon name={TRUST_ICONS[i] ?? "check"} size={16} />
                </span>
                {tr(t)}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 size-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/30 blur-3xl" />
          <div className="max-h-[27rem] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] lg:max-h-none lg:[mask-image:none]">
            <PhonePreview />
          </div>
        </div>
      </div>
    </section>
  )
}
