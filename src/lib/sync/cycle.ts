import type { DeviceInfo } from "../store/device"
import { classifyError, type PulledPage, type SyncStatus, type Transport } from "./engine"
import type { SyncEvent } from "./events"

/** একবারের সিংক-চক্রের নির্ভরতা: ডিভাইস, API ও অবস্থা জানানো (React থেকে আলাদা, তাই পরীক্ষা করা যায়) */
export interface CycleDeps {
  device(): DeviceInfo
  saveDeviceCode(code: string): void
  registerDevice(deviceId: string): Promise<string>
  pushEvents(deviceId: string, events: SyncEvent[]): Promise<void>
  pullEvents(after: number, limit: number): Promise<PulledPage>
  syncNow(transport: Transport): Promise<SyncStatus | "busy">
  /** সিংকের বাইরের ধাপে (নিবন্ধন) বা অপ্রত্যাশিত ব্যর্থতার অবস্থা পর্দায় জানাতে */
  note(status: SyncStatus): void
  /** অপ্রত্যাশিত ত্রুটি নিজের সার্ভারে রিপোর্ট (কখনো ছোঁড়ে না) */
  report(err: unknown): void
}

/**
 * একবার: ডিভাইস নিবন্ধন (দরকার হলে), তারপর সিংক। কখনো ছোঁড়ে না (আগে `void run()`-এ ছুঁড়লে unhandled rejection হতো),
 * আর নিবন্ধন ব্যর্থ হলে আগের মতো চুপচাপ ফেরে না: কারণ (লগইন/ডিভাইস-সীমা/অফলাইন) জানায়।
 */
export async function runSyncCycle(d: CycleDeps): Promise<SyncStatus | "busy"> {
  const device = d.device()
  if (!device.code) {
    try {
      d.saveDeviceCode(await d.registerDevice(device.id))
    } catch (err) {
      const status = classifyError(err)
      d.note(status)
      return status
    }
  }
  const transport: Transport = {
    push: (events) => d.pushEvents(device.id, events),
    pull: (after, limit) => d.pullEvents(after, limit),
  }
  try {
    return await d.syncNow(transport)
  } catch (err) {
    d.report(err)
    d.note("error")
    return "error"
  }
}
