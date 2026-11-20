/* eslint-disable no-console -- a build script: printing to the terminal is its output */
// After `next build`: hash every inline <script> in out/**/*.html and write out/_headers with a strict CSP (no 'unsafe-inline' for scripts).
// A static host cannot mint per-request nonces, so build-time sha256 hashes are the strict option. Hosts that read `_headers`
// (Cloudflare Pages, Netlify) apply it as is; for others copy the CSP line into the host's header config.
//   ADMIN_API_ORIGIN  the API origin the panel may call, e.g. https://abcd.supabase.co (default: same origin only)
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function htmlFilesIn(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) out.push(...htmlFilesIn(p))
    else if (name.endsWith(".html")) out.push(p)
  }
  return out
}

/** inline script bodies (no src attribute), exactly as the browser hashes them */
export function inlineScripts(html) {
  const found = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? ""
    if (/\bsrc\s*=/.test(attrs)) continue
    if (m[2] === "") continue
    found.push(m[2])
  }
  return found
}

export const sha256 = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`

export function buildHeaders(htmls, apiOrigin) {
  const hashes = [...new Set(htmls.flatMap(inlineScripts).map(sha256))].sort()
  // inline styles (a <style> block or style="" attribute) would need 'unsafe-inline'; refuse instead of weakening the policy
  for (const h of htmls) {
    if (/<style\b/i.test(h) || /\sstyle\s*=\s*"/i.test(h)) throw new Error("inline style found in built HTML: the strict CSP forbids it")
  }
  const connect = ["'self'", apiOrigin].filter(Boolean).join(" ")
  const csp = [
    "default-src 'none'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
  ].join("; ")
  return [
    "/*",
    `  Content-Security-Policy: ${csp}`,
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
    "  Cache-Control: no-store",
    "",
    "/_next/static/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out")
  const files = htmlFilesIn(out)
  const headers = buildHeaders(files.map((f) => readFileSync(f, "utf8")), process.env.ADMIN_API_ORIGIN ?? "")
  writeFileSync(path.join(out, "_headers"), headers)
  console.log(`out/_headers written (${files.length} pages hashed)`)
}
