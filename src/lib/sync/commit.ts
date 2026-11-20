import type { Db } from "../store/types"
import { eventsFromChange } from "./diff"
import type { SyncState } from "./state"

export interface PlannedCommit {
  /** স্থানীয়ভাবে সেভ করার ডেটা (ঘড়ি/rcpt বসানো, ইভেন্ট তৈরি ব্যর্থ হলে next-ই) */
  db: Db
  /** সিংক-অবস্থা, কিউতে নতুন ইভেন্টসহ */
  state: SyncState
  /** ইভেন্ট তৈরি ব্যর্থ হয়েছে: বদল ফোনে থাকে, কিন্তু সার্ভারে যাওয়ার কিউতে ওঠেনি */
  queueFailed: boolean
}

/**
 * স্থানীয় বদল থেকে সিংক ইভেন্ট বের করে কিউতে রাখার বিশুদ্ধ হিসাব।
 * ইভেন্ট তৈরি ছুঁড়লেও ব্যবহারকারীর বদল হারায় না। কিন্তু আগের মতো চুপ থাকে না:
 * `queueFailed` জানায়, আর `seeded: false` করে দেয় যাতে পরের লোডে পুরো ডেটা স্থির-id ইভেন্টে আবার কিউতে ওঠে
 * (একই id, তাই সার্ভারে দ্বিগুণ হয় না)। ফলে বিল দেখতে ঠিক থাকলেও সার্ভারে কখনো যাবে না, এমনটা আর হয় না।
 */
export function planCommit(prev: Db, next: Db, state: SyncState, newId: () => string, now: Date): PlannedCommit {
  try {
    const diff = eventsFromChange(prev, next, newId, now)
    const nextState = diff.events.length > 0 ? { ...state, outbox: [...state.outbox, ...diff.events] } : state
    return { db: diff.db, state: nextState, queueFailed: false }
  } catch {
    return { db: next, state: { ...state, seeded: false }, queueFailed: true }
  }
}
