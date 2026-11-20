"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { getMe } from "@/lib/api/endpoints"
import { ApiError } from "@/lib/api/client"
import { clearSession, loadSession, saveSession, type Session } from "@/lib/auth/storage"

type AuthState = { status: "loading" } | { status: "anon" } | ({ status: "authed" } & Session)

interface AuthContextValue {
  state: AuthState
  signIn: (session: Session) => void
  signOut: () => void
  /** দোকানের নাম বদলের পর সেশনে নতুন দোকান বসায় */
  setStore: (store: NonNullable<Session["store"]>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth অবশ্যই AuthProvider-এর ভেতরে ব্যবহার করতে হবে")
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" })

  const signOut = useCallback(() => {
    clearSession()
    setState({ status: "anon" })
  }, [])

  // ব্যাকগ্রাউন্ডে দোকানের তথ্য ও ইউজারের অবস্থা হালনাগাদ; অফলাইনে ব্যর্থ হলে সংরক্ষিত সেশনেই চলে
  const refresh = useCallback(
    async (session: Session) => {
      try {
        const me = await getMe(session.token)
        const next: Session = { token: session.token, user: me.user, store: me.store }
        saveSession(next)
        setState({ status: "authed", ...next })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signOut()
      }
    },
    [signOut],
  )

  useEffect(() => {
    const saved = loadSession()
    if (!saved) {
      setState({ status: "anon" })
      return
    }
    setState({ status: "authed", ...saved })
    void refresh(saved)
  }, [refresh])

  const signIn = useCallback(
    (session: Session) => {
      saveSession(session)
      setState({ status: "authed", ...session })
      void refresh(session)
    },
    [refresh],
  )

  const setStore = useCallback((store: NonNullable<Session["store"]>) => {
    setState((prev) => {
      if (prev.status !== "authed") return prev
      const next: Session = { token: prev.token, user: prev.user, store }
      saveSession(next)
      return { status: "authed", ...next }
    })
  }, [])

  const value = useMemo(() => ({ state, signIn, signOut, setStore }), [state, signIn, signOut, setStore])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
