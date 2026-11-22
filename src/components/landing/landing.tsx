"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { InstallSection } from "./install-section"
import { LandingHero } from "./landing-hero"
import { LandingNav } from "./landing-nav"
import { CtaBand, Features, LandingFooter, ShopTypes, Steps } from "./landing-sections"

/** হোম-স্ক্রিন থেকে খোলা (ইনস্টল করা) অ্যাপে ল্যান্ডিং দেখানোর দরকার নেই, সরাসরি লগইনে যাবে */
function isInstalledApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
}

export function Landing() {
  const router = useRouter()

  useEffect(() => {
    if (isInstalledApp()) router.replace("/login")
  }, [router])

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <LandingNav />
      <main>
        <LandingHero />
        <ShopTypes />
        <Features />
        <Steps />
        <InstallSection />
        <CtaBand />
      </main>
      <div className="app-skyline mx-auto max-w-5xl opacity-90" aria-hidden="true" />
      <LandingFooter />
    </div>
  )
}
