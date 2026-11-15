# pos_fontend

ফার্মেসি ও কসমেটিক্স দোকানের মোবাইল-প্রথম POS। Next.js (App Router) + TypeScript + Tailwind, স্ট্যাটিক export করা PWA।
ব্যাকএন্ড: [`pos_backend`](https://github.com/showmik121/pos_backend) (Supabase Edge Function + PostgreSQL)।

## এখন যা কাজ করে (ধাপ F0 + F1)

- লগইন, দোকান খোলা (`/login`, `/signup`), সেটিংস, কর্মচারী যোগ/বন্ধ (`/settings`, `/settings/staff`)
- নিচের ৫ ট্যাবের কাঠামো (হোম, বিল, স্টক, বাকি, রিপোর্ট); শেষ চারটি এখনো "শীঘ্রই আসছে"
- PWA: ম্যানিফেস্ট, আইকন, service worker (পেজ ও স্ট্যাটিক ফাইল অফলাইনে খোলে)
- পুরো UI বাংলায়; মোবাইল নম্বর বাংলা বা ইংরেজি অঙ্কে লেখা যায়, API-তে ইংরেজি অঙ্ক যায়

বিক্রি, স্ক্যানার, স্টক, বাকি, অফলাইন সিংক পরের ধাপে (পরিকল্পনা ডকে F2–F7)।

## চালানো

```bash
npm install
npm run dev        # http://localhost:3000
```

ডিফল্টে লাইভ ব্যাকএন্ডে যায়। অন্য ঠিকানা লাগলে `.env.example` কপি করে `.env.local` বানিয়ে `NEXT_PUBLIC_API_URL` বদলান।

> লোকালে `localhost:3000` থেকে লগইন চলবে কারণ ব্যাকএন্ডের `ALLOWED_ORIGINS`-এ সেটি আছে। অন্য ঠিকানা (হোস্ট করা সাইট) থেকে চালালে সেই ঠিকানা ব্যাকএন্ডের `ALLOWED_ORIGINS` secret-এ যোগ করতে হবে, নইলে ব্রাউজার (CORS) আটকাবে।

## কমান্ড

| কমান্ড | কাজ |
| --- | --- |
| `npm run dev` | ডেভ সার্ভার |
| `npm run build` | স্ট্যাটিক সাইট তৈরি (`out/`) |
| `npm run typecheck` | TypeScript যাচাই |
| `npm test` | Vitest টেস্ট |

CI (GitHub Actions) প্রতি পুশে typecheck, test ও build চালায়।

## কাঠামো

```
public/            manifest, আইকন, sw.js
src/app/           রাউট (login, signup, settings, sell, stock, dues, reports)
src/components/    AppShell, BottomNav, AuthProvider, ui/
src/lib/api/       API ক্লায়েন্ট, zod স্কিমা, এন্ডপয়েন্ট
src/lib/auth/      সেশন সংরক্ষণ
src/lib/format/    বাংলা অঙ্ক, ফোন নম্বর
tests/             Vitest
```

## নিরাপত্তার নোট

- সেশন টোকেন `localStorage`-এ থাকে (ব্যাকএন্ডে টোকেনের মেয়াদ এখন ১২ ঘণ্টা)। হোস্ট করার সময় CSP হেডার দিন।
- পাসওয়ার্ড কোথাও সংরক্ষিত হয় না; শুধু API-তে HTTPS-এ যায়।
