"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { dbStorageKey, emptyDb, loadDb, newId, saveDb } from "@/lib/store/db"
import type { Db } from "@/lib/store/types"
import { planCommit } from "@/lib/sync/commit"
import { runSync, type SyncStatus, type Transport } from "@/lib/sync/engine"
import { seedEvents } from "@/lib/sync/seed"
import { loadSyncState, saveSyncState, type SyncState } from "@/lib/sync/state"

interface DbContextValue {
  db: Db
  /** লোকাল ডেটা লোড হয়ে গেছে কি না */
  ready: boolean
  /** সর্বশেষ সেভ ব্যর্থ হলে true (স্টোরেজ ভরা/বন্ধ) */
  saveFailed: boolean
  /** সিংকের কিউতে বদল তোলা ব্যর্থ হয়েছে (ফোনে আছে, সার্ভারে পরের লোডে যাবে) */
  queueFailed: boolean
  /** ডেটা বদলায়; ব্যর্থ হলে DomainError ছোঁড়ে (পর্দা ধরে বার্তা দেখাবে) */
  update: (fn: (db: Db) => Db) => void
  /** ডেটা বদলে একটি মান ফেরত দেয় (যেমন নতুন পণ্য বা বিল) */
  run: <R,>(fn: (db: Db) => { db: Db; value: R }) => R
  /** সিংক অবস্থা (দেখানোর জন্য) */
  syncInfo: SyncInfo
  /** একবার সিংক চালায়; একসাথে দুটি চলে না। টোকেন/ডিভাইস id দিয়ে ট্রান্সপোর্ট বানানো ডাকার দায়িত্ব। */
  syncNow: (transport: Transport) => Promise<SyncStatus | "busy">
}

export interface SyncInfo {
  /** পাঠানো বাকি ইভেন্ট */
  pending: number
  /** সার্ভার বারবার ফেরত দিয়ে বাদ পড়া ইভেন্ট */
  dropped: number
  lastSyncAt: string | null
  status: SyncStatus | null
}

const NO_SYNC: SyncInfo = { pending: 0, dropped: 0, lastSyncAt: null, status: null }
const infoOf = (s: SyncState, status: SyncStatus | null): SyncInfo => ({ pending: s.outbox.length, dropped: s.dropped, lastSyncAt: s.lastSyncAt, status })

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
  const [queueFailed, setQueueFailed] = useState(false)
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(NO_SYNC)
  const running = useRef(false)
  const lastStatus = useRef<SyncStatus | null>(null)
  // সংরক্ষণ ব্যর্থ হলে (স্টোরেজ বন্ধ) মেমরির কপি; নইলে সত্য-উৎস localStorage, যাতে একাধিক ট্যাব একে অপরের কিউ না মোছে
  const syncMem = useRef<SyncState | null>(null)

  const readSync = useCallback((): SyncState => (storeId ? (syncMem.current ?? loadSyncState(storeId)) : loadSyncState("")), [storeId])
  const writeSync = useCallback(
    (next: SyncState) => {
      if (!storeId) return
      syncMem.current = saveSyncState(storeId, next) ? null : next
      setSyncInfo(infoOf(next, lastStatus.current))
    },
    [storeId],
  )

  useEffect(() => {
    if (!storeId) {
      ref.current = emptyDb()
      setDb(ref.current)
      setReady(false)
      return
    }
    syncMem.current = null
    let loaded = loadDb(storeId)
    const st = loadSyncState(storeId)
    if (!st.seeded) {
      // সিংক চালুর আগের ডেটা একবার ইভেন্ট করে কিউতে তোলা (স্থির id, তাই দুই ফোন থেকে গেলেও দ্বিগুণ গোনা পড়ে না)
      const seeded = seedEvents(loaded)
      loaded = seeded.db
      saveDb(storeId, loaded)
      saveSyncState(storeId, { ...st, seeded: true, outbox: [...st.outbox, ...seeded.events] })
    }
    ref.current = loaded
    setDb(ref.current)
    setSyncInfo(infoOf(loadSyncState(storeId), null))
    setReady(true)
  }, [storeId])

  // অন্য ট্যাব/উইন্ডো একই ডেটা বদলালে সেটিই নিই, নইলে এই ট্যাবের পুরনো কপি দিয়ে সেটি ঘষে ফেলা হতো
  useEffect(() => {
    if (!storeId) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== dbStorageKey(storeId)) return
      ref.current = loadDb(storeId)
      setDb(ref.current)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [storeId])

  const commit = useCallback(
    (next: Db) => {
      let out = next
      if (storeId) {
        // স্থানীয় বদল থেকে সিংক ইভেন্ট বের করে কিউতে রাখা। ব্যর্থ হলেও ব্যবহারকারীর কাজ আটকায় না, কিন্তু আর চুপও থাকে না:
        // queueFailed জানায়, আর পরের লোডে পুরো ডেটা আবার কিউতে তোলা হয় (lib/sync/commit.ts)
        const st = readSync()
        const plan = planCommit(ref.current, next, st, newId, new Date())
        out = plan.db
        if (plan.state !== st) writeSync(plan.state)
        if (plan.queueFailed) setQueueFailed(true)
      }
      ref.current = out
      setDb(out)
      if (storeId) setSaveFailed(!saveDb(storeId, out))
    },
    [storeId, readSync, writeSync],
  )

  // সেভ ব্যর্থ থাকলে সদ্য-করা বিল শুধু খোলা অ্যাপের মেমরিতে আছে: ভুলে পাতা বন্ধ/রিলোড করলে হারাবে, তাই আগে সতর্ক করি
  useEffect(() => {
    if (!saveFailed) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saveFailed])

  const syncNow = useCallback(
    async (transport: Transport): Promise<SyncStatus | "busy"> => {
      if (!storeId || running.current) return "busy"
      running.current = true
      try {
        const status = await runSync({
          io: {
            db: () => ref.current,
            setDb: (d) => {
              ref.current = d
              setDb(d)
              setSaveFailed(!saveDb(storeId, d))
            },
            state: readSync,
            setState: writeSync,
          },
          transport,
          now: new Date(),
        })
        lastStatus.current = status
        setSyncInfo(infoOf(readSync(), status))
        return status
      } finally {
        running.current = false
      }
    },
    [storeId, readSync, writeSync],
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

  const value = useMemo(
    () => ({ db, ready, saveFailed, queueFailed, update, run, syncInfo, syncNow }),
    [db, ready, saveFailed, queueFailed, update, run, syncInfo, syncNow],
  )
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>
}
