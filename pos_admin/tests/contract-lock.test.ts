// The UI's copy of the admin contract must be byte-identical to the backend's: contract.lock pins both files.
// Fails when someone edits the copy here, or copies a newer backend contract without its contract.lock.
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
// @ts-expect-error plain .mjs helper without types
import { computeLock } from "../scripts/contract-lock.mjs"

describe("admin contract copy", () => {
  it("matches contract.lock (copy src/contract/admin-api.ts, src/domain/admin-permissions.ts and contract.lock from pos_backend together)", () => {
    expect(computeLock()).toBe(readFileSync(path.join(process.cwd(), "contract.lock"), "utf8").trim())
  })
})
