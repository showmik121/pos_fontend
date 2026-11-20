import { apiRequest } from "./client"
import {
  AccountActivitySchema,
  AuthResponseSchema,
  DeviceResponseSchema,
  MeResponseSchema,
  PullResponseSchema,
  PushResponseSchema,
  StaffListSchema,
  StoreResponseSchema,
  UserResponseSchema,
  type StoreKind,
} from "./schemas"

export function login(phone: string, password: string) {
  return apiRequest("/v1/auth/login", (d) => AuthResponseSchema.parse(d), {
    method: "POST",
    body: { phone, password },
  })
}

export interface RegisterStoreInput {
  storeName: string
  storeKind: StoreKind
  ownerName: string
  phone: string
  password: string
}

export function registerStore(input: RegisterStoreInput) {
  return apiRequest("/v1/auth/register-store", (d) => AuthResponseSchema.parse(d), { method: "POST", body: input })
}

export function getMe(token: string) {
  return apiRequest("/v1/me", (d) => MeResponseSchema.parse(d), { token })
}

/** অ্যাকাউন্টে অপারেটর কী করেছে (সাসপেন্ড অবস্থাতেও চলে); ভেতরের কারণ আসে না */
export function getAccountActivity(token: string) {
  return apiRequest("/v1/account-activity", (d) => AccountActivitySchema.parse(d).activity, { token })
}

/** দোকানের নাম বদলায় (শুধু মালিক) */
export function renameStore(token: string, name: string) {
  return apiRequest("/v1/store", (d) => StoreResponseSchema.parse(d).store, { method: "PATCH", token, body: { name } })
}

export function listStaff(token: string) {
  return apiRequest("/v1/staff", (d) => StaffListSchema.parse(d).staff, { token })
}

export function createStaff(token: string, input: { name: string; phone: string; password: string }) {
  return apiRequest("/v1/staff", (d) => UserResponseSchema.parse(d).user, { method: "POST", token, body: input })
}

export function setStaffActive(token: string, id: string, active: boolean) {
  return apiRequest(`/v1/staff/${id}`, (d) => UserResponseSchema.parse(d).user, {
    method: "PATCH",
    token,
    body: { active },
  })
}

/** এই ফোনকে দোকানে নিবন্ধন করে A–Z কোড নেয়; একই deviceId আবার দিলে একই কোড ফেরে */
export function registerDevice(token: string, deviceId: string) {
  return apiRequest("/v1/sync/register-device", (d) => DeviceResponseSchema.parse(d).code, {
    method: "POST",
    token,
    body: { deviceId },
  })
}

/** ইভেন্ট পাঠায় (একই id আবার গেলে সার্ভার ডুপ্লিকেট রাখে না) */
export function pushEvents(token: string, deviceId: string, events: unknown[]) {
  return apiRequest("/v1/sync/push", (d) => PushResponseSchema.parse(d), { method: "POST", token, body: { deviceId, events } })
}

/** `after`-এর পরের ইভেন্ট টানে */
export function pullEvents(token: string, after: number, limit: number) {
  return apiRequest(`/v1/sync/pull?after=${after}&limit=${limit}`, (d) => PullResponseSchema.parse(d), { token })
}
