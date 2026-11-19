import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
// ফন্ট প্যাকেজ থেকেই আসে (বিল্ডে Google Fonts-এ নেটওয়ার্ক-ডাক নেই): আগে next/font/google বিল্ড-সময়ে ডাউনলোড করত,
// নেটওয়ার্ক ঝামেলায় Netlify বিল্ড এলোমেলো ভাবে ভাঙত। আগের মতোই শুধু বাংলা সাবসেট, ওজন ৪০০/৫০০/৭০০, display: swap।
import "@fontsource/noto-sans-bengali/bengali-400.css"
import "@fontsource/noto-sans-bengali/bengali-500.css"
import "@fontsource/noto-sans-bengali/bengali-700.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "Bipone — বিক্রি ও স্টক",
  description: "ফার্মেসি ও কসমেটিক্স দোকানের বিক্রি, স্টক ও বাকির হিসাব",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-v3-192.png", apple: "/icons/apple-touch-icon-v3.png" },
  appleWebApp: { capable: true, title: "Bipone", statusBarStyle: "default" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFEBB0",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
