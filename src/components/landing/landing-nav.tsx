"use client"

import Link from "next/link"
import { useLang } from "@/components/lang-provider"
import { Logo } from "@/components/logo"
import { tr } from "@/lib/i18n"
import { InstallButton } from "./install-section"

const LINKS = [
  { href: "#features", label: "সুবিধা" },
  { href: "#steps", label: "শুরুর ধাপ" },
  { href: "#install", label: "ইনস্টল" },
] as const

/** ওপরে আটকে থাকা নেভিগেশন: মোবাইলে লোগো + ভাষা + লগইন, বড় পর্দায় লিংক ও দোকান খোলার বোতামসহ */
export function LandingNav() {
  const { lang, setLang } = useLang()
  const other = lang === "bn" ? "en" : "bn"
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Bipone" className="flex-none">
          <Logo size={38} tagline={false} />
        </Link>
        <nav aria-label={tr("মূল মেনু")} className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[15px] font-medium text-ink2 transition-colors hover:bg-brand-soft hover:text-brand-dark">
              {tr(l.label)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            lang={other}
            aria-label="ভাষা / Language"
            onClick={() => setLang(other)}
            className="min-h-10 rounded-xl border border-line bg-white px-3 text-[13px] font-semibold text-ink2 active:bg-canvas"
          >
            {other === "en" ? "English" : "বাংলা"}
          </button>
          <div className="hidden lg:block">
            <InstallButton variant="secondary" className="min-h-10 rounded-xl px-3 text-[14px]" />
          </div>
          <Link href="/login" className="inline-flex min-h-10 items-center rounded-xl px-3 text-[15px] font-semibold text-brand-dark active:bg-brand-soft">
            {tr("লগইন")}
          </Link>
          <Link href="/signup" className="btn-primary-grad hidden min-h-10 items-center rounded-xl px-4 text-[14.5px] font-semibold text-white sm:inline-flex">
            {tr("দোকান খুলুন")}
          </Link>
        </div>
      </div>
    </header>
  )
}
