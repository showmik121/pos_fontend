"use client"

import type { StoreKind } from "@/lib/api/schemas"
import { tr } from "@/lib/i18n"
import Link from "next/link"
import { useBackupDue } from "./backup-reminder"
import { Icon } from "./ui/icons"

interface HomeHeaderProps {
  storeName: string
  greeting: string
  /** দোকানের ধরন অনুযায়ী ছবি: ফার্মেসি, কসমেটিক্স, বাকিরা (জেনারেল স্টোর) */
  kind: StoreKind | undefined
}

/** হোমের ছবিওয়ালা হেডার: শুভেচ্ছা, দোকানের নাম, প্রোফাইল বোতাম (সেটিংসে যায়); নিচে জলরঙের শহুরে দৃশ্য (ফার্মেসি, কসমেটিক্স ও জেনারেল স্টোরের ছবি আলাদা) */
export function HomeHeader({ storeName, greeting, kind }: HomeHeaderProps) {
  const backupDue = useBackupDue()
  return (
    <header className="home-hero no-print" data-kind={kind === "pharmacy" || kind === "cosmetics" ? kind : "retail"}>
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
          aria-label={backupDue ? tr("প্রোফাইল ও সেটিংস — আজকের ব্যাকআপ বাকি") : tr("প্রোফাইল ও সেটিংস")}
          className="relative grid size-11 shrink-0 place-items-center rounded-full bg-white/70 text-ink shadow-sm active:bg-white"
        >
          <Icon name="user" size={22} />
          {backupDue ? <span aria-hidden="true" className="absolute right-1 top-1 size-3 rounded-full bg-amber-500 ring-2 ring-white" /> : null}
        </Link>
      </div>
      <div aria-hidden="true" className="home-hero-space" />
    </header>
  )
}
