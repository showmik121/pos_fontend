// `out/` (next build এর স্ট্যাটিক export) পরিবেশন করে। trailingSlash এর মতো /sell/ → /sell/index.html।
// শুধু E2E এর জন্য; কোনো বাড়তি প্যাকেজ লাগে না।
import { createReadStream, existsSync, statSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out")
const port = Number(process.env.E2E_PORT ?? 3210)
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain" }

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)))
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end()
        return
      }
      file = path.join(file, "index.html")
    }
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found")
      return
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`E2E সার্ভার: http://localhost:${port}`))
