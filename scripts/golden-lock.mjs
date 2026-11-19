// গোল্ডেন ফিক্সচারের SHA-256 তালিকা। ফিক্সচার বদলালে `node scripts/golden-lock.mjs` চালিয়ে
// tests/fixtures/domain/fixtures.lock নতুন করুন, তারপর একই ফাইল ও JSON-গুলো পিওএস ব্যাকএন্ডের
// tests/fixtures/domain/ এ কপি করুন (দুই রিপোর লক একই হতে হবে)।
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "domain")
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
const lines = files.map((f) => `${createHash("sha256").update(readFileSync(join(dir, f))).digest("hex")}  ${f}`)
writeFileSync(join(dir, "fixtures.lock"), lines.join("\n") + "\n")
console.log(lines.join("\n"))
