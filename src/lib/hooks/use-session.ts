"use client"

import { useAuth } from "@/components/auth-provider"

export interface SessionInfo {
  actor: string
  isOwner: boolean
  isPharmacy: boolean
  storeName: string
  storeId: string | null
}

/** লগইন করা ইউজারের সংক্ষিপ্ত তথ্য; লগইন না থাকলে ডিফল্ট মান */
export function useSessionInfo(): SessionInfo {
  const { state } = useAuth()
  if (state.status !== "authed") return { actor: "", isOwner: false, isPharmacy: false, storeName: "", storeId: null }
  return { actor: state.user.name, isOwner: state.user.role === "owner", isPharmacy: state.store?.kind === "pharmacy", storeName: state.store?.name ?? "", storeId: state.store?.id ?? null }
}
