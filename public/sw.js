// হাতে লেখা ছোট service worker: অ্যাপ শেল অফলাইনে খোলার জন্য।
// API (অন্য origin) কখনো ক্যাশ হয় না; শুধু একই origin-এর GET অনুরোধ।
const VERSION = "v15"
const PAGES = `pos-pages-${VERSION}`
const ASSETS = `pos-assets-${VERSION}`
// ক্যাশ অনির্দিষ্ট বাড়তে দেওয়া যাবে না (ফোনের জায়গা সীমিত; কোয়েরিসহ পেজ ?id=… আলাদা এন্ট্রি হয়)।
// সীমা ছাড়ালে সবচেয়ে পুরনো এন্ট্রি আগে যায়। প্রি-ক্যাশ করা অ্যাপ-শেল পেজ ১০টির বেশি, তাই PAGES-এর সীমা তার চেয়ে অনেক বেশি।
const MAX_PAGES = 60
const MAX_ASSETS = 150
const PRECACHE = [
  "/",
  "/login/",
  "/signup/",
  "/sell/",
  "/stock/",
  "/dues/",
  "/reports/",
  "/settings/",
  "/manifest.webmanifest",
  "/icons/icon-v3-192.png",
  "/icons/apple-touch-icon-v3.png",
]

/** শুধু সফল (২xx) উত্তর ক্যাশ হয়; ৪০৪/৫০০ বা রিডাইরেক্ট ক্যাশ করে অফলাইনে ভুল পাতা দেখানো হয় না। পরে সীমা মানে। */
async function putLimited(cacheName, max, req, res) {
  if (!res || !res.ok) return
  const cache = await caches.open(cacheName)
  await cache.put(req, res)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)))
}

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
          event.waitUntil(putLimited(PAGES, MAX_PAGES, req, res.clone()).catch(() => {}))
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
            event.waitUntil(putLimited(ASSETS, MAX_ASSETS, req, res.clone()).catch(() => {}))
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
          event.waitUntil(putLimited(ASSETS, MAX_ASSETS, req, res.clone()).catch(() => {}))
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})
