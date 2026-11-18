import type { Metadata, Viewport } from "next"
import { Noto_Sans_Bengali } from "next/font/google"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import "./globals.css"

const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-bengali",
})

export const metadata: Metadata = {
  title: "দোকান POS",
  description: "ফার্মেসি ও কসমেটিক্স দোকানের বিক্রি, স্টক ও বাকির হিসাব",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "দোকান POS", statusBarStyle: "default" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F766E",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={bengali.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
