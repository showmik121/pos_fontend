/** সার্ভার UUID চায়; randomUUID না থাকা পুরনো ব্রাউজারেও UUID v4 বানায় */
function newDeviceId(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined
  if (typeof c?.randomUUID === "function") return c.randomUUID()
  const b = new Uint8Array(16)
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** এই ফোনের পরিচয়: id ফোনেই তৈরি, code (A–Z) সার্ভার দেয় এবং বিল নম্বরের উপসর্গ হয় */
export interface DeviceInfo {
  id: string
  code: string | null
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">

const CODE_PATTERN = /^[A-Z]$/

// ব্যাকআপে এটি নেই: ব্যাকআপ অন্য ফোনে ফেরালে দুই ফোন এক কোড পেত
export const deviceStorageKey = (storeId: string) => `pos.device.v1.${storeId}`

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function parseDevice(raw: string): DeviceInfo | null {
  try {
    const d: unknown = JSON.parse(raw)
    if (typeof d !== "object" || d === null) return null
    const { id, code } = d as Record<string, unknown>
    if (typeof id !== "string" || id.length < 8) return null
    return { id, code: typeof code === "string" && CODE_PATTERN.test(code) ? code : null }
  } catch {
    return null
  }
}

function write(storeId: string, info: DeviceInfo, storage: KeyValueStorage | null): void {
  try {
    storage?.setItem(deviceStorageKey(storeId), JSON.stringify(info))
  } catch {
    // স্টোরেজ বন্ধ: পরের বার আবার চেষ্টা হবে
  }
}

export function loadDevice(storeId: string, storage: KeyValueStorage | null = defaultStorage()): DeviceInfo {
  try {
    const raw = storage?.getItem(deviceStorageKey(storeId))
    const parsed = raw ? parseDevice(raw) : null
    if (parsed) return parsed
  } catch {
    // নতুন করে বানাই
  }
  const fresh: DeviceInfo = { id: newDeviceId(), code: null }
  write(storeId, fresh, storage)
  return fresh
}

export function saveDeviceCode(storeId: string, code: string, storage: KeyValueStorage | null = defaultStorage()): void {
  const current = loadDevice(storeId, storage)
  write(storeId, { ...current, code }, storage)
}
