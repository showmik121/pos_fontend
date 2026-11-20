import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { EN } from "../src/lib/i18n/en"
import { setCurrentLang, tf, tr } from "../src/lib/i18n"
import { toBanglaDigits } from "../src/lib/format/bn"
import { formatDateBn } from "../src/lib/domain/dates"
import { formatTaka } from "../src/lib/domain/money"
import { greetingBn } from "../src/lib/format/datetime"

afterEach(() => setCurrentLang("bn"))

const BN_CHAR = /[ঀ-৿]/
/** ৳ চিহ্ন (U+09F3) ইংরেজি লেখাতেও থাকে */
const BN_LETTER = /[\u0980-\u09F2\u09F4-\u09FF]/
const PLACEHOLDER = /\{\w+\}/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === "i18n" ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

/** কোডে সরাসরি লেখা tr("…")/tf("…") লেখাগুলো */
function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>()
  const pattern = /\b(?:tr|tf)\(\s*"((?:[^"\\]|\\.)*)"/g
  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8")
    for (const m of text.matchAll(pattern)) {
      const key = (m[1] ?? "").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
      if (BN_CHAR.test(key)) keys.set(key, file)
    }
  }
  return keys
}

describe("ভাষা (বাংলা/ইংরেজি)", () => {
  it("বাংলায় tr লেখা বদলায় না", () => {
    expect(tr("বাকির খাতা")).toBe("বাকির খাতা")
    expect(tf("{p0}টি বিল", { p0: 3 })).toBe("3টি বিল")
    expect(toBanglaDigits(12)).toBe("১২")
  })

  it("ইংরেজিতে অনুবাদ, অঙ্ক ও মাস ইংরেজি; অনুবাদ না থাকলে বাংলাই থাকে", () => {
    setCurrentLang("en")
    expect(tr("বাকির খাতা")).toBe("Due ledger")
    expect(tf("{p0} পিস বিক্রি", { p0: toBanglaDigits(5) })).toBe("5 pcs sold")
    expect(tr("এমন লেখা যার অনুবাদ নেই")).toBe("এমন লেখা যার অনুবাদ নেই")
    expect(formatDateBn("2026-11-20")).toBe("20 November 2026")
    expect(formatTaka(125000)).toContain("1,250")
    expect(greetingBn(9)).toBe("Good Morning")
  })

  it("কোডে ব্যবহৃত প্রতিটি লেখার ইংরেজি আছে এবং {…} জায়গাগুলো মেলে", () => {
    const missing: string[] = []
    const mismatched: string[] = []
    for (const [key, file] of usedKeys()) {
      const en = EN[key]
      if (en === undefined) {
        missing.push(`${file}: ${key}`)
        continue
      }
      const a = (key.match(PLACEHOLDER) ?? []).sort().join()
      const b = (en.match(PLACEHOLDER) ?? []).sort().join()
      if (a !== b) mismatched.push(key)
    }
    expect(missing).toEqual([])
    expect(mismatched).toEqual([])
  })

  it("অনুবাদে কোনো বাংলা অক্ষর থাকে না (ভাষার নাম ছাড়া)", () => {
    const leftovers = Object.entries(EN).filter(([key, en]) => BN_LETTER.test(en) && key !== "ভাষা / Language")
    expect(leftovers.map(([k]) => k)).toEqual([])
  })
})
