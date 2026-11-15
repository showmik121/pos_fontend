import { apiRequest } from "./client"
import {
  AuthResponseSchema,
  MeResponseSchema,
  StaffListSchema,
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
