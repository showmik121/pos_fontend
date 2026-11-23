import { describe, expect, it } from "vitest"
import type { AdminSummary } from "@/contract/admin-api"
import { ApiError, friendlyError } from "@/lib/api"
import { accountState, canActOn, passwordProblem, ROLE_LABEL } from "@/lib/admin-accounts"

const base: AdminSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "a@bipone.test",
  name: "A",
  role: "support",
  active: true,
  enrolled: true,
  mustReenroll: false,
  lastLoginAt: null,
  createdAt: "2026-11-20T00:00:00.000Z",
}

describe("accountState", () => {
  it("is Active when enrolled and active", () => {
    expect(accountState(base)).toEqual({ label: "Active", tone: "ok" })
  })
  it("is Deactivated whenever active is false, even if 2FA is missing", () => {
    expect(accountState({ ...base, active: false, enrolled: false }).label).toBe("Deactivated")
  })
  it("says 2FA must be set up again after a reset", () => {
    expect(accountState({ ...base, enrolled: false, mustReenroll: true })).toEqual({ label: "Must set up 2FA again", tone: "warn" })
  })
  it("says 2FA is not set up for a new admin", () => {
    expect(accountState({ ...base, enrolled: false }).label).toBe("2FA not set up yet")
  })
})

describe("canActOn", () => {
  it("never lets an operator change their own account (the server refuses it too)", () => {
    expect(canActOn(base.id, base)).toBe(false)
    expect(canActOn("33333333-3333-4333-8333-333333333333", base)).toBe(true)
  })
  it("fails closed when nobody is signed in", () => {
    expect(canActOn(null, base)).toBe(false)
  })
})

describe("passwordProblem", () => {
  it("matches the server rule: 12 to 128 characters", () => {
    expect(passwordProblem("short")).toMatch(/at least 12/)
    expect(passwordProblem("x".repeat(129))).toMatch(/at most 128/)
    expect(passwordProblem("x".repeat(12))).toBeNull()
    expect(passwordProblem("x".repeat(128))).toBeNull()
  })
  it("counts a space as a character and does not trim", () => {
    expect(passwordProblem("            ")).toBeNull()
  })
})

describe("role labels", () => {
  it("covers every role in the contract", () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual(["finance", "super", "support", "viewer"])
  })
})

describe("friendlyError for admin accounts", () => {
  it("explains a duplicate email and the last-super-admin rule in English, never the raw server text", () => {
    expect(friendlyError(new ApiError(409, "email_taken", "এই ইমেইলে আগেই অ্যাডমিন আছে"))).toBe("An admin with this email already exists.")
    expect(friendlyError(new ApiError(409, "last_super_admin", "শেষ সুপার অ্যাডমিনকে সরানো বা নামানো যাবে না"))).toBe(
      "The last active super admin cannot be demoted or deactivated. Make another super admin first.",
    )
  })
})
