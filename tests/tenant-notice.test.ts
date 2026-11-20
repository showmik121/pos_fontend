import { describe, expect, it } from "vitest"
import { AccountActivitySchema, MeResponseSchema, StoreSchema } from "../src/lib/api/schemas"
import { tenantNotice } from "../src/lib/account/notice"

describe("tenantNotice: what the owner is told", () => {
  it("a sync that just failed with suspended/read_only wins", () => {
    expect(tenantNotice({ storeStatus: "active", sync: "suspended", message: "বকেয়া" })).toEqual({ kind: "suspended", message: "বকেয়া" })
    expect(tenantNotice({ storeStatus: null, sync: "read_only", message: null })).toEqual({ kind: "read_only", message: null })
  })
  it("falls back to the status from the last /v1/me while offline or before the first sync", () => {
    expect(tenantNotice({ storeStatus: "suspended", sync: null, message: null })?.kind).toBe("suspended")
    expect(tenantNotice({ storeStatus: "read_only", sync: "offline", message: null })?.kind).toBe("read_only")
  })
  it("a successful sync clears a stale restricted status (the operator reactivated the shop)", () => {
    expect(tenantNotice({ storeStatus: "suspended", sync: "ok", message: "x" })).toBeNull()
  })
  it("pending deletion and deleted read as suspended; healthy statuses show nothing", () => {
    expect(tenantNotice({ storeStatus: "pending_deletion", sync: null, message: null })?.kind).toBe("suspended")
    for (const s of ["trial", "active", "grace", "cancelled", null] as const) expect(tenantNotice({ storeStatus: s, sync: null, message: null })).toBeNull()
  })
})

describe("API schemas stay backward compatible", () => {
  it("accepts an older server that sends no status", () => {
    expect(StoreSchema.parse({ id: "s", name: "n", kind: "pharmacy" }).status).toBeUndefined()
    expect(MeResponseSchema.parse({ user: { id: "u", storeId: "s", name: "n", phone: "01711111111", role: "owner", active: true }, store: null }).store).toBeNull()
  })
  it("reads status and message when present", () => {
    expect(StoreSchema.parse({ id: "s", name: "n", kind: "pharmacy", status: "suspended", statusMessage: "বকেয়া" })).toMatchObject({ status: "suspended", statusMessage: "বকেয়া" })
  })
  it("account activity carries only when/what/message", () => {
    expect(AccountActivitySchema.parse({ activity: [{ at: "2026-01-01T00:00:00.000Z", status: "suspended", message: null }] }).activity).toHaveLength(1)
  })
})
