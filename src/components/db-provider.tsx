"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { DomainError } from "@/lib/domain/errors"
import { tr } from "@/lib/i18n"
import { dbStorageKey, emptyDb, loadDb, newId, readDb, saveDb } from "@/lib/store/db"
import { acquireWriter } from "@/lib/store/tab-lock"
import type { Db } from "@/lib/store/types"
import { planCommit } from "@/lib/sync/commit"
import { runSync, type SyncStatus, type Transport } from "@/lib/sync/engine"
import { seedEvents } from "@/lib/sync/seed"
import { loadSyncState, saveSyncState, type SyncState } from "@/lib/sync/state"
import { retryRejected, stuckDeferred } from "@/lib/sync/tracking"

interface DbContextValue {
  db: Db
  /** লোকাল ডেটা লোড হয়ে গেছে কি না */
  ready: boolean
  /** সর্বশেষ সেভ ব্যর্থ হলে true (স্টোরেজ ভরা/বন্ধ) */
  saveFailed: boolean
  /** সিংকের কিউতে বদল তোলা ব্যর্থ হয়েছে (ফোনে আছে, সার্ভারে পরের লোডে যাবে) */
  queueFailed: boolean
  /** সিংকের অবস্থা (কিউ, কার্সর) ফোনে সেভ হচ্ছে না; পাঠানো বাকি বদল শুধু খোলা অ্যাপের মেমরিতে */
  syncSaveFailed: boolean
  /** অন্য ট্যাব দোকানের ডেটা লিখছে: এই ট্যাব শুধু দেখতে পারে (লিখতে গেলে DomainError) */
  readOnlyTab: boolean
  /** এই ট্যাবকে লেখক বানায় (অন্য ট্যাব শুধু-দেখা হয়ে যায়) */
  takeOverTab: () => void
  /** ডেটা বদলায়; ব্যর্থ হলে DomainError ছোঁড়ে (পর্দা ধরে বার্তা দেখাবে) */
  update: (fn: (db: Db) => Db) => void
  /** ডেটা বদলে একটি মান ফেরত দেয় (যেমন নতুন পণ্য বা বিল) */
  run: <R,>(fn: (db: Db) => { db: Db; value: R }) => R
  /** সিংক অবস্থা (দেখানোর জন্য) */
  syncInfo: SyncInfo
  /** সিংক অবস্থার পূর্ণ তালিকা (সমস্যার বিবরণ দেখানোর জন্য) */
  readSyncState: () => SyncState
  /** একবার সিংক চালায়; একসাথে দুটি চলে না। টোকেন/ডিভাইস id দিয়ে ট্রান্সপোর্ট বানানো ডাকার দায়িত্ব। */
  syncNow: (transport: Transport) => Promise<SyncStatus | "busy">
  /** সিংকের বাইরের ধাপের (নিবন্ধন) বা অপ্রত্যাশিত ব্যর্থতার অবস্থা পর্দায় জানায় */
  noteSyncStatus: (status: SyncStatus) => void
  /** সার্ভার যে বদল নেয়নি, সেগুলো আবার পাঠানোর লাইনে তোলে */
  retryRejectedEvents: () => void
  /** "সিংক-অবস্থা নষ্ট ছিল" বার্তা দেখা হয়েছে */
  ackSyncDamaged: () => void
}

export interface SyncInfo {
  /** পাঠানো বাকি ইভেন্ট */
  pending: number
  /** আগের সংস্করণে সার্ভার বারবার ফেরত দিয়ে বাদ পড়া ইভেন্ট (এখন বাদ না দিয়ে `rejected`-এ রাখা হয়) */
  dropped: number
  lastSyncAt: string | null
  status: SyncStatus | null
  /** সার্ভার নেয়নি, ফোনে রাখা */
  rejected: number
  /** পেয়েছি কিন্তু বসাতে পারিনি */
  skipped: number
  /** কাঠামো নষ্ট ইভেন্ট */
  malformed: number
  /** ২৪ ঘণ্টার বেশি অপেক্ষায় */
  stuck: number
  /** সীমার কারণে তালিকা থেকে বাদ */
  evicted: number
  /** সিংক-অবস্থা নষ্ট ছিল */
  damaged: boolean
  /** ব্যানারের জন্য মোট সমস্যা */
  problems: number
}

const NO_SYNC: SyncInfo = { pending: 0, dropped: 0, lastSyncAt: null, status: null, rejected: 0, skipped: 0, malformed: 0, stuck: 0, evicted: 0, damaged: false, problems: 0 }

function infoOf(s: SyncState, status: SyncStatus | null, now: Date = new Date()): SyncInfo {
  const stuck = stuckDeferred(s, now).length
  return {
    pending: s.outbox.length,
    dropped: s.dropped,
    lastSyncAt: s.lastSyncAt,
    status,
    rejected: s.rejected.length,
    skipped: s.skipped.length,
    malformed: s.malformed,
    stuck,
    evicted: s.evicted,
    damaged: s.damaged,
    problems: s.rejected.length + s.skipped.length + stuck + s.malformed + (s.damaged ? 1 : 0),
  }
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
  const [queueFailed, setQueueFailed] = useState(false)
  const [syncSaveFailed, setSyncSaveFailed] = useState(false)
  const [readOnlyTab, setReadOnlyTab] = useState(false)
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(NO_SYNC)
  const running = useRef(false)
  const lastStatus = useRef<SyncStatus | null>(null)
  const readOnlyRef = useRef(false)
  const releaseWriter = useRef<(() => void) | null>(null)
  // সংরক্ষণ ব্যর্থ হলে (স্টোরেজ বন্ধ) মেমরির কপি; নইলে সত্য-উৎস localStorage, যাতে একাধিক ট্যাব একে অপরের কিউ না মোছে
  const syncMem = useRef<SyncState | null>(null)

  const setReadOnly = useCallback((v: boolean) => {
    readOnlyRef.current = v
    setReadOnlyTab(v)
  }, [])

  const readSync = useCallback((): SyncState => (storeId ? (syncMem.current ?? loadSyncState(storeId)) : loadSyncState("")), [storeId])
  const writeSync = useCallback(
    (next: SyncState) => {
      if (!storeId) return
      const ok = saveSyncState(storeId, next)
      syncMem.current = ok ? null : next
      setSyncSaveFailed(!ok)
      setSyncInfo(infoOf(next, lastStatus.current))
    },
    [storeId],
  )

  // দোকান-ভিত্তিক একক লেখক-লক: দুই ট্যাব একসাথে লিখলে একটির বিল অন্যটি ঘষে দিত (#15)
  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    void acquireWriter({ storeId, onLost: () => setReadOnly(true) }).then((r) => {
      if (cancelled) {
        if (r.status === "writer") r.release()
        return
      }
      releaseWriter.current = r.status === "writer" ? r.release : null
      setReadOnly(r.status === "reader")
    })
    return () => {
      cancelled = true
      releaseWriter.current?.()
      releaseWriter.current = null
    }
  }, [storeId, setReadOnly])

  const takeOverTab = useCallback(() => {
    if (!storeId) return
    void acquireWriter({ storeId, steal: true, onLost: () => setReadOnly(true) }).then((r) => {
      if (r.status === "reader") return
      releaseWriter.current = r.status === "writer" ? r.release : null
      // আগের লেখক ট্যাবের সর্বশেষ সেভ নিয়ে শুরু, নইলে পুরনো কপি দিয়ে সেটি ঘষা হতো
      const fresh = readDb(storeId)
      if (fresh) {
        ref.current = fresh
        setDb(fresh)
      }
      setReadOnly(false)
    })
  }, [storeId, setReadOnly])

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
    let current = st
    if (!st.seeded) {
      // সিংক চালুর আগের (বা নষ্ট অবস্থার পর সব) ডেটা একবার ইভেন্ট করে কিউতে তোলা (স্থির id, তাই দুই ফোন থেকে গেলেও দ্বিগুণ গোনা পড়ে না)
      const seeded = seedEvents(loaded)
      loaded = seeded.db
      saveDb(storeId, loaded)
      current = { ...st, seeded: true, outbox: [...st.outbox, ...seeded.events] }
      if (!saveSyncState(storeId, current)) {
        syncMem.current = current
        setSyncSaveFailed(true)
      }
    }
    ref.current = loaded
    setDb(ref.current)
    setSyncInfo(infoOf(current, null))
    setReady(true)
  }, [storeId])

  // অন্য ট্যাব/উইন্ডো একই ডেটা বদলালে সেটিই নিই, নইলে এই ট্যাবের পুরনো কপি দিয়ে সেটি ঘষে ফেলা হতো।
  // পড়া না গেলে বা নষ্ট হলে চলমান ডেটাই থাকে: ফাঁকা ডেটা বসালে সব মুছে যেত।
  useEffect(() => {
    if (!storeId) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== dbStorageKey(storeId)) return
      const fresh = readDb(storeId)
      if (!fresh) return
      ref.current = fresh
      setDb(fresh)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [storeId])

  const commit = useCallback(
    (next: Db) => {
      if (readOnlyRef.current) {
        throw new DomainError("tab_readonly", tr("এই ট্যাবে এখন শুধু দেখা যায়: অ্যাপটি আরেকটি ট্যাব বা উইন্ডোতে খোলা আছে। সেখানেই কাজ করুন, অথবা এখানে 'এই ট্যাবে কাজ করুন' চাপুন।"))
      }
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

  // সেভ ব্যর্থ থাকলে সদ্য-করা বিল (বা সিংক-লাইন) শুধু খোলা অ্যাপের মেমরিতে আছে: ভুলে পাতা বন্ধ/রিলোড করলে হারাবে, তাই আগে সতর্ক করি
  useEffect(() => {
    if (!saveFailed && !syncSaveFailed) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saveFailed, syncSaveFailed])

  const syncNow = useCallback(
    async (transport: Transport): Promise<SyncStatus | "busy"> => {
      // শুধু-দেখা ট্যাব সিংক করে না: পুরনো মেমরির কপি দিয়ে লেখক ট্যাবের ডেটা ঘষে ফেলত
      if (!storeId || running.current || readOnlyRef.current) return "busy"
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

  const noteSyncStatus = useCallback(
    (status: SyncStatus) => {
      lastStatus.current = status
      setSyncInfo(infoOf(readSync(), status))
    },
    [readSync],
  )

  const retryRejectedEvents = useCallback(() => {
    writeSync(retryRejected(readSync()))
  }, [readSync, writeSync])

  const ackSyncDamaged = useCallback(() => {
    writeSync({ ...readSync(), damaged: false })
  }, [readSync, writeSync])

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
    () => ({ db, ready, saveFailed, queueFailed, syncSaveFailed, readOnlyTab, takeOverTab, update, run, syncInfo, readSyncState: readSync, syncNow, noteSyncStatus, retryRejectedEvents, ackSyncDamaged }),
    [db, ready, saveFailed, queueFailed, syncSaveFailed, readOnlyTab, takeOverTab, update, run, syncInfo, readSync, syncNow, noteSyncStatus, retryRejectedEvents, ackSyncDamaged],
  )
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>
}
