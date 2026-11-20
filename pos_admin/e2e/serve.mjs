/* eslint-disable no-console -- a test server: printing to the terminal is its output */
// Serves out/ exactly as a static host would, INCLUDING the generated out/_headers (so the strict CSP is really enforced in the e2e run).
import { createServer } from "node:http"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out")
const port = Number(process.env.E2E_PORT ?? 3220)
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".ico": "image/x-icon", ".svg": "image/svg+xml" }

// the `/*` block of _headers
const globalHeaders = {}
let inGlobal = false
for (const line of readFileSync(path.join(root, "_headers"), "utf8").split("\n")) {
  if (line.startsWith("/")) inGlobal = line.trim() === "/*"
  else if (inGlobal && line.trim()) {
    const i = line.indexOf(":")
    globalHeaders[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
}

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0])
  const candidates = [clean, path.join(clean, "index.html"), `${clean}.html`]
  for (const c of candidates) {
    const p = path.join(root, c)
    if (p.startsWith(root) && statSync(p, { throwIfNoEntry: false })?.isFile()) return p
  }
  return null
}

createServer((req, res) => {
  const file = resolve(req.url ?? "/")
  const headers = { ...globalHeaders }
  if (!file) {
    res.writeHead(404, { ...headers, "content-type": TYPES[".html"] })
    res.end(readFileSync(path.join(root, "404.html")))
    return
  }
  res.writeHead(200, { ...headers, "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
  res.end(readFileSync(file))
}).listen(port, () => console.log(`e2e server on :${port}`))
