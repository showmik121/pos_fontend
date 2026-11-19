import Link from "next/link"
import { Icon } from "./ui/icons"

interface HomeHeaderProps {
  storeName: string
  greeting: string
}

/** হোমের ছবিওয়ালা হেডার: শুভেচ্ছা, দোকানের নাম, সেটিংস; নিচে বাংলার বাজারের দৃশ্য */
export function HomeHeader({ storeName, greeting }: HomeHeaderProps) {
  return (
    <header className="home-hero no-print">
      <div className="relative z-10 flex items-center gap-3 px-4 pb-2 pt-5">
        <span
          aria-hidden="true"
          className="block size-11 shrink-0 rounded-[22%] shadow-md ring-1 ring-black/5"
          style={{ background: 'url("/icons/logo.svg") center / cover no-repeat' }}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-medium text-muted">{greeting}</p>
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{storeName}</h1>
        </div>
        <Link
          href="/settings"
          aria-label="সেটিংস"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/70 text-ink shadow-sm active:bg-white"
        >
          <Icon name="sliders" size={22} />
        </Link>
      </div>
      <div aria-hidden="true" className="home-hero-space" />
    </header>
  )
}
