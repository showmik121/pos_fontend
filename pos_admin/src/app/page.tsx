"use client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useSession } from "@/lib/session"

export default function Home() {
  const { admin } = useSession()
  const router = useRouter()
  useEffect(() => {
    router.replace(admin ? "/dashboard/" : "/login/")
  }, [admin, router])
  return <p className="p-6 text-sm text-[var(--muted)]">Loading…</p>
}
