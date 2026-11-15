// হাতে লেখা ছোট service worker: অ্যাপ শেল অফলাইনে খোলার জন্য।
// API (অন্য origin) কখনো ক্যাশ হয় না; শুধু একই origin-এর GET অনুরোধ।
const VERSION = "v1"
const PAGES = `pos-pages-${VERSION}`
const ASSETS = `pos-assets-${VERSION}`
const PRECACHE = ["/", "/login/", "/manifest.webmanifest", "/icons/icon-192.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url)))).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // পেজ: আগে নেটওয়ার্ক, না পেলে ক্যাশ, তাও না পেলে হোম শেল
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(PAGES).then((c) => c.put(req, copy))
          return res
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()),
    )
    return
  }

  // হ্যাশ-করা স্ট্যাটিক ফাইল ও আইকন: ক্যাশ আগে
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(ASSETS).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
    return
  }

  // বাকি: ক্যাশ দেখিয়ে পেছনে হালনাগাদ
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(ASSETS).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})
