// Local development only: forwards API calls to the live Supabase function and answers CORS for any origin.
// Use it when the app is opened from a port/address that the live server's ALLOWED_ORIGINS does not list
// (localhost:3001, 127.0.0.1, a phone on the same Wi-Fi). Never deploy this.
//
//   npm run dev:proxy        (then set NEXT_PUBLIC_API_URL=http://localhost:8787 in .env.local and restart `npm run dev`)
import http from "node:http"
import { spawn } from "node:child_process"

const TARGET = (process.env.PROXY_TARGET || "https://gaxzkbcomeexlnzquvzf.supabase.co/functions/v1/api").replace(/\/+$/, "")
const PORT = Number(process.env.PROXY_PORT || 8787)

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*")
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
}

http
  .createServer(async (req, res) => {
    cors(req, res)
    if (req.method === "OPTIONS") {
      res.statusCode = 204
      return res.end()
    }
    try {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const body = chunks.length ? Buffer.concat(chunks) : undefined
      const headers = {}
      for (const h of ["authorization", "content-type"]) if (req.headers[h]) headers[h] = req.headers[h]
      const upstream = await fetch(TARGET + req.url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body })
      res.statusCode = upstream.status
      const type = upstream.headers.get("content-type")
      if (type) res.setHeader("Content-Type", type)
      res.end(Buffer.from(await upstream.arrayBuffer()))
    } catch (e) {
      res.statusCode = 502
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ error: { code: "proxy_error", message: String(e?.message || e) } }))
    }
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`dev proxy: http://localhost:${PORT} -> ${TARGET}`)
    // `npm run dev:local` = proxy + Next dev server that already points at the proxy (no .env.local edit needed)
    if (process.argv.includes("--next")) {
      const next = spawn("npx", ["next", "dev", ...process.argv.slice(process.argv.indexOf("--next") + 1)], {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, NEXT_PUBLIC_API_URL: `http://localhost:${PORT}` },
      })
      next.on("exit", (code) => process.exit(code ?? 0))
    }
  })
