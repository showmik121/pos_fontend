import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { computeCart, settlePayments } from "../src/lib/domain/cart"
import { stockIn } from "../src/lib/store/actions"
import { emptyDb } from "../src/lib/store/db"
import type { Product } from "../src/lib/store/types"
import { DomainError } from "../src/lib/domain/errors"
import { classifyExpiry } from "../src/lib/domain/expiry"
import { allocateFifo } from "../src/lib/domain/fifo"
import { toBaseUnits } from "../src/lib/domain/units"

// গোল্ডেন ফিক্সচার: এই রিপোর ডোমেইন-যুক্তিই সত্য-উৎস। ব্যাকএন্ড (pos_backend) একই JSON চালায়।
const DIR = join(__dirname, "fixtures", "domain")

type Case = {
  name: string
  input: Record<string, unknown>
  output?: unknown
  error?: { code: string; details?: unknown }
}
type Fixture = { fn: string; cases: Case[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapters: Record<string, (i: any) => unknown> = {
  classifyExpiry: (i) => classifyExpiry(i.expiryDate, i.today),
  toBaseUnits: (i) => toBaseUnits(i),
  computeCart: (i) => computeCart(i.lines, i.bill),
  settlePayments: (i) => settlePayments(i),
  allocateFifo: (i) => allocateFifo(i.batches, i.qtyNeeded, i.today),
  // BE-র planStockIn(product, cmd) এর সমতুল্য: stockIn() চালিয়ে জন্মানো ব্যাচ ও পণ্য থেকে একই চার মান পড়ি
  planStockIn: (i) => {
    const product = { id: "p1", name: "পণ্য", barcodes: [], unit: "piece", minStock: 0, category: "", open: false, createdAt: "2026-01-01T00:00:00.000Z", costPoisha: 0, ...i.product } as Product
    const { product: _p, ...cmd } = i
    const db = stockIn({ ...emptyDb(), products: [product] }, { ...cmd, productId: "p1" }, new Date("2026-11-12T06:00:00.000Z"))
    const batch = db.batches[0]!
    return { pieces: batch.qtyRemaining, costPerPiece: batch.costPoisha, batchNo: batch.batchNo, pricePoisha: db.products[0]!.pricePoisha }
  },
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()

describe("গোল্ডেন ফিক্সচার", () => {
  it("তালিকা লকের সাথে মেলে (বদলালে scripts/golden-lock.mjs চালান ও ব্যাকএন্ডে কপি করুন)", () => {
    const lock = readFileSync(join(DIR, "fixtures.lock"), "utf8").trim()
    const actual = files
      .map((f) => `${createHash("sha256").update(readFileSync(join(DIR, f))).digest("hex")}  ${f}`)
      .join("\n")
    expect(actual).toBe(lock)
  })

  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(DIR, file), "utf8")) as Fixture
    describe(`${file} → ${fixture.fn}`, () => {
      const run = adapters[fixture.fn]
      it("ফাংশনের অ্যাডাপ্টার আছে", () => expect(run).toBeTypeOf("function"))
      for (const c of fixture.cases) {
        it(c.name, () => {
          if (c.error) {
            let thrown: unknown
            try {
              run!(c.input)
            } catch (e) {
              thrown = e
            }
            expect(thrown).toBeInstanceOf(DomainError)
            expect((thrown as DomainError).code).toBe(c.error.code)
            if (c.error.details) expect((thrown as DomainError).details).toEqual(c.error.details)
          } else {
            expect(run!(c.input)).toEqual(c.output)
          }
        })
      }
    })
  }
})
