// Netlify build step: builds the operator panel (pos_admin/) for the /admin path and copies it into the shop site's out/ folder,
// so https://<site>/admin/ serves it. Run after `next build` (npm run build:site). The panel keeps its own strict CSP: its rules are
// added to out/_headers under /admin/*. Both apps share one origin, so the shop's service worker skips /admin (public/sw.js).
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ADMIN_PATH = "/admin"

/** The panel's own build writes a standalone `_headers` (rules for `/*`); this turns it into rules that apply under /admin only. */
export function adminHeaderRules(standalone) {
  const lines = standalone.split("\n").map((line) => {
    if (line.trim() === "/*") return `${ADMIN_PATH}/*`
    if (line.startsWith("/")) return `${ADMIN_PATH}${line}`
    return line
  })
  const first = lines.indexOf(`${ADMIN_PATH}/*`)
  if (first === -1) throw new Error("pos_admin/out/_headers has no /* block")
  lines.splice(first + 1, 0, "  X-Robots-Tag: noindex, nofollow")
  return lines.join("\n").trimEnd() + "\n"
}

function apiUrl(root) {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")
  const m = /DEFAULT_API_URL\s*=\s*"([^"]+)"/.exec(readFileSync(path.join(root, "src/lib/api/client.ts"), "utf8"))
  if (!m?.[1]) throw new Error("cannot find the shop's DEFAULT_API_URL")
  return m[1]
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const site = path.join(root, "out")
  const admin = path.join(root, "pos_admin")
  if (!existsSync(path.join(site, "_headers"))) throw new Error("out/_headers missing: run `next build` first")
  const api = apiUrl(root)
  const env = { ...process.env, ADMIN_BASE_PATH: ADMIN_PATH, NEXT_PUBLIC_ADMIN_API_URL: api, ADMIN_API_ORIGIN: new URL(api).origin }
  const build = spawnSync("npm", ["run", "build"], { cwd: admin, env, stdio: "inherit", shell: process.platform === "win32" })
  if (build.status !== 0) throw new Error("pos_admin build failed")

  const rules = adminHeaderRules(readFileSync(path.join(admin, "out", "_headers"), "utf8"))
  cpSync(path.join(admin, "out"), path.join(site, "admin"), { recursive: true, filter: (src) => path.basename(src) !== "_headers" })
  const shop = readFileSync(path.join(site, "_headers"), "utf8")
  writeFileSync(path.join(site, "_headers"), `${shop.trimEnd()}\n\n# ---- operator panel (scripts/embed-admin.mjs)\n${rules}`)
  console.log(`admin panel embedded at ${ADMIN_PATH}/ (API ${new URL(api).origin})`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
