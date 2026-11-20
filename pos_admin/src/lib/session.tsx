"use client"
// Operator session, in memory only (D4). A reload or a closed tab ends it; the server also ends it after 30 min idle / 8 h.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { AdminSummary } from "@/contract/admin-api"
import { can, type AdminAction } from "@/domain/admin-permissions"
import { call, tokenStore } from "@/lib/api"

interface SessionState {
  admin: AdminSummary | null
  stepUpUntil: number | null
}

interface SessionApi extends SessionState {
  /** hand over a fully authenticated session (after 2FA / enrol) */
  start(token: string, admin: AdminSummary): void
  signOut(): Promise<void>
  /** true when the role may do the action; the SERVER still decides, this only hides buttons */
  allowed(action: AdminAction): boolean
  stepUpValid(): boolean
  confirmStepUp(password: string, code: string): Promise<void>
}

const Ctx = createContext<SessionApi | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<SessionState>({ admin: null, stepUpUntil: null })

  const clear = useCallback(() => {
    tokenStore.set(null)
    setState({ admin: null, stepUpUntil: null })
  }, [])

  useEffect(() => {
    tokenStore.onLost(() => {
      clear()
      router.replace("/login/?expired=1")
    })
    return () => tokenStore.onLost(null)
  }, [clear, router])

  const start = useCallback((token: string, admin: AdminSummary) => {
    tokenStore.set(token)
    setState({ admin, stepUpUntil: null })
  }, [])

  const signOut = useCallback(async () => {
    try {
      await call("auth.logout")
    } catch {
      // the server session may already be gone; either way this browser forgets the token
    }
    clear()
    router.replace("/login/")
  }, [clear, router])

  const confirmStepUp = useCallback(async (password: string, code: string) => {
    const r = await call("auth.step-up", { input: { password, code } })
    setState((s) => ({ ...s, stepUpUntil: Date.parse(r.stepUpUntil) }))
  }, [])

  const api = useMemo<SessionApi>(
    () => ({
      ...state,
      start,
      signOut,
      confirmStepUp,
      allowed: (action) => (state.admin ? can(state.admin.role, action) : false),
      stepUpValid: () => state.stepUpUntil !== null && state.stepUpUntil > Date.now() + 5_000,
    }),
    [state, start, signOut, confirmStepUp],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useSession(): SessionApi {
  const v = useContext(Ctx)
  if (!v) throw new Error("useSession outside SessionProvider")
  return v
}
