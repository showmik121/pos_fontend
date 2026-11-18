# অনবোর্ডিং গাইড: POS (ফ্রন্টএন্ড)

## ১. এক নজরে
বাংলাদেশের ফার্মেসি ও কসমেটিক্স দোকানের মোবাইল-প্রথম POS। ফোনে PWA হিসেবে চলে, UI পুরো বাংলায়। মালিক ও কর্মচারী পণ্য ও স্টক সামলান, বিল কাটেন, বাকির খাতা রাখেন, দিনের হিসাব দেখেন।

দুটি রিপো মিলে একটি সিস্টেম:

| রিপো | কাজ | কোথায় চলে |
|---|---|---|
| `pos_fontend` (এটি) | UI, লোকাল ডেটা, হিসাবের যুক্তি | Netlify (স্ট্যাটিক সাইট) |
| `pos_backend` | লগইন, দোকান, কর্মচারী API | Supabase Edge Function + PostgreSQL |

## ২. সিস্টেম ম্যাপ

```
ফোনের ব্রাউজার (PWA)
 ├─ পেজ (src/app)  ──►  src/lib/store/actions.ts  ──►  src/lib/domain (বিশুদ্ধ হিসাব)
 │                              │
 │                              ▼
 │                    localStorage  pos.db.v1.<storeId>
 │                    (পণ্য, ব্যাচ, বিল, কাস্টমার, বাকি)   ← এখন শুধু ফোনে
 │
 └─ src/lib/api  ──HTTPS + Bearer টোকেন──►  Supabase Edge Function  /api/v1/...
                                              └─ PostgreSQL (RLS)   ← লগইন, দোকান, কর্মচারী
```

মূল কথা: **সার্ভারে এখন শুধু পরিচয় (লগইন/দোকান/কর্মচারী)**। বাকি সব ডেটা ফোনে। সিংক পরের ধাপ।

## ৩. এন্ট্রি পয়েন্ট

| কী খুঁজছেন | কোথায় |
|---|---|
| অ্যাপ শুরু, ফন্ট, মেটাডেটা | `src/app/layout.tsx` |
| প্রোভাইডার ও service worker নিবন্ধন | `src/components/providers.tsx` (`AuthProvider` > `DbProvider`) |
| লগইন অবস্থা, না থাকলে `/login`-এ পাঠানো | `src/components/auth-provider.tsx`, `app-shell.tsx` |
| সেশন টোকেন সংরক্ষণ | `src/lib/auth/storage.ts` |
| সার্ভার API ডাকা | `src/lib/api/client.ts`, `endpoints.ts`, `schemas.ts` (zod) |
| লোকাল ডেটার গঠন | `src/lib/store/types.ts`, `db.ts` |
| ডেটা বদলের সব ক্রিয়া (বিশুদ্ধ ফাংশন) | `src/lib/store/actions.ts` |
| প্রশ্ন/হিসাব (মোট, বাকি, মেয়াদ, স্টক কম) | `src/lib/store/selectors.ts` |
| টাকা, ইউনিট, FIFO, কার্ট, মেয়াদ | `src/lib/domain/*` |
| নিচের ৫ ট্যাব | `src/components/bottom-nav.tsx` |
| অফলাইন ক্যাশ | `public/sw.js`, `public/manifest.webmanifest` |

## ৪. ডিরেক্টরি ম্যাপ
```
src/app/            রাউট: login, signup, sell/*, stock/*, products/*, dues/*, reports/*, settings/*
src/components/     AppShell, BottomNav, providers, scanner, product-form, customer-picker, ui/
src/lib/domain/     money, units, dates, expiry, fifo, cart, errors
src/lib/store/      types, db, actions, selectors, csv, seed, search
src/lib/api/        client, endpoints, schemas
src/lib/format/     bn (বাংলা অঙ্ক), phone, datetime
tests/              domain, store, client, bn
```
ডায়নামিক রাউট নেই (static export); আইডি যায় কোয়েরি প্যারামে (`?id=`, `?product=`, `?barcode=`)।

## ৫. একটি বিক্রির যাত্রা (প্রধান প্রবাহ)
1. `/sell`: পণ্য খুঁজে বা স্ক্যান করে `addToCart` (খসড়া `db.draft`-এ থাকে, পেজ বদলালেও হারায় না)।
2. `/sell/discount`: লাইন বা পুরো বিলে ছাড়; `computeCart` মোট হিসাব করে।
3. `/sell/pay`: ক্যাশ/মোবাইল/বাকি ভাগ করা; বাকি হলে কাস্টমার বাধ্যতামূলক।
4. `completeSale`: **FIFO** ব্যাচ থেকে স্টক কাটে (মেয়াদোত্তীর্ণ বাদ), বিল নম্বর দেয়, বাকি হলে খাতায় লেখে। যেকোনো ভুলে `DomainError` ছোঁড়ে, ডেটা অক্ষত থাকে।
5. `/sell/receipt?id=`: রসিদ, শেয়ার বা প্রিন্ট।

## ৬. ডোমেইন নিয়ম
- টাকা **পূর্ণসংখ্যা পয়সায়**, স্টক **পিসে**; কার্টন/বক্স পিসে রূপান্তর হয় `units.ts`-এ।
- **FIFO:** সবচেয়ে আগে মেয়াদ শেষ হবে এমন ব্যাচ আগে বিক্রি।
- **মেয়াদ:** মাসের শেষ তারিখ; ≤০ দিন expired, ≤৩০ critical, ≤৯০ soon।
- **বাকির খাতা:** কাস্টমারভিত্তিক ledger; বাকিতে বিক্রি বাকি বাড়ায়, জমা নিলে কমে।
- শতাংশ ছাড় `percent × 100` হিসেবে; বিল নম্বর ১০০১ থেকে।

## ৭. কনভেনশন
- `domain/` ও `store/actions.ts` বিশুদ্ধ ও immutable: নতুন `Db` ফেরত দেয়, পুরনোটা বদলায় না। UI-তে হিসাব নয়।
- ভুলের বার্তা বাংলায়, `DomainError` দিয়ে।
- `useSearchParams` ব্যবহারকারী পেজ `Suspense`-এ মোড়া; `db` পড়ে `useState` শুরু করা পেজ `Ready`-তে মোড়া।
- ফাইল kebab-case, কম্পোনেন্ট PascalCase, `@/*` = `src/*`।
- কমিট: `type: বর্ণনা`। কমিটের আগে `npm run typecheck && npm test && npm run build`।
- টেস্ট `tests/*.test.ts`, Vitest; লজিক বদলালে আগে টেস্ট।

## ৮. প্রথম দিন
```bash
git clone https://github.com/showmik121/pos_fontend && cd pos_fontend
npm install
npm run dev        # http://localhost:3000
npm test
```
শুরুতে ডেটা খালি। লগইনের পর সেটিংসের "নমুনা তথ্য দিয়ে দেখুন" চাপলে ৮টি পণ্য ও ৩ জন কাস্টমার আসে।

## ৯. জানা সীমাবদ্ধতা ও পরের কাজ
- পণ্য, স্টক, বিল ও বাকি এখনো শুধু ফোনে; ব্রাউজারের ডেটা মুছলে হারায়। **ব্যাকএন্ডে এসবের API ও সিংক বানানো সবচেয়ে বড় বাকি কাজ।**
- আসল ফোনে ম্যানুয়াল পরীক্ষা নেই; কম্পোনেন্ট টেস্ট নেই। E2E আছে মূল পথের, নকল ও আসল ব্যাকএন্ড (Postgres সহ) দুই জবে; স্টাফ, ব্যাকআপ-পুনরুদ্ধার, অফলাইন পথ নেই।
- ক্যামেরা স্ক্যান নির্ভর করে ব্রাউজারের `BarcodeDetector`-এর ওপর; ইমপোর্ট শুধু CSV।
- অ্যাপের নাম ঠিক হয়নি।
