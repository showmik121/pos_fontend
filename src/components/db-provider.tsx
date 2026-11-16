"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { emptyDb, loadDb, saveDb } from "@/lib/store/db"
import type { Db } from "@/lib/store/types"

interface DbContextValue {
  db: Db
  /** লোকাল ডেটা লোড হয়ে গেছে কি না */
  ready: boolean
  /** সর্বশেষ সেভ ব্যর্থ হলে true (স্টোরেজ ভরা/বন্ধ) */
  saveFailed: boolean
  /** ডেটা বদলায়; ব্যর্থ হলে DomainError ছোঁড়ে (পর্দা ধরে বার্তা দেখাবে) */
  update: (fn: (db: Db) => Db) => void
  /** ডেটা বদলে একটি মান ফেরত দেয় (যেমন নতুন পণ্য বা বিল) */
  run: <R,>(fn: (db: Db) => { db: Db; value: R }) => R
}

const DbContext = createContext<DbContextValue | null>(null)

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext)
  if (!ctx) throw new Error("useDb অবশ্যই DbProvider-এর ভেতরে ব্যবহার করতে হবে")
  return ctx
}

export function DbProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const storeId = state.status === "authed" && state.store ? state.store.id : null

  const ref = useRef<Db>(emptyDb())
  const [db, setDb] = useState<Db>(ref.current)
  const [ready, setReady] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (!storeId) {
      ref.current = emptyDb()
      setDb(ref.current)
      setReady(false)
      return
    }
    ref.current = loadDb(storeId)
    setDb(ref.current)
    setReady(true)
  }, [storeId])

  const commit = useCallback(
    (next: Db) => {
      ref.current = next
      setDb(next)
      if (storeId) setSaveFailed(!saveDb(storeId, next))
    },
    [storeId],
  )

  const update = useCallback(
    (fn: (db: Db) => Db) => {
      commit(fn(ref.current))
    },
    [commit],
  )

  const run = useCallback(
    <R,>(fn: (db: Db) => { db: Db; value: R }): R => {
      const out = fn(ref.current)
      commit(out.db)
      return out.value
    },
    [commit],
  )

  const value = useMemo(() => ({ db, ready, saveFailed, update, run }), [db, ready, saveFailed, update, run])
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>
}
