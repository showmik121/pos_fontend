# pos_fontend — CLAUDE.md

বাংলাদেশের ফার্মেসি ও কসমেটিক্স দোকানের **মোবাইল-প্রথম POS (PWA)**। UI সম্পূর্ণ বাংলায়। ব্যাকএন্ড আলাদা রিপো: `showmik121/pos_backend` (Supabase Edge Function + PostgreSQL)।

## স্ট্যাক
Next.js 15 (App Router, `output: "export"`, `trailingSlash`) · React 19 · TypeScript strict (`noUncheckedIndexedAccess`) · Tailwind v4 (`@theme` টোকেন `src/app/globals.css`-এ) · zod · Vitest · হাতে লেখা `public/sw.js` · Noto Sans Bengali। Node >= 20।

## কমান্ড
```bash
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # স্ট্যাটিক সাইট -> out/
```
CI (`.github/workflows/ci.yml`): `npm install` → typecheck → test → build। কমিটের আগে চারটিই পাস করাতে হবে। লকফাইল নেই, তাই `npm ci` নয়, `npm install`।

## আর্কিটেকচার
পুরো অ্যাপ ক্লায়েন্ট-সাইড; কোনো সার্ভার রানটাইম নেই। Netlify-তে স্ট্যাটিক হোস্ট (`https://bipone.netlify.app/`)।

```
src/app/            রাউট। ডায়নামিক সেগমেন্ট নেই (static export), তাই ?id= / ?product= / ?barcode= কোয়েরি প্যারাম
src/components/     AppShell, BottomNav, providers, scanner, product-form, customer-picker, ui/
src/lib/domain/     বিশুদ্ধ হিসাব: money, units, dates, expiry, fifo, cart, errors
src/lib/store/      লোকাল ডেটা: types, db, actions, selectors, csv, seed, search
src/lib/api/        ব্যাকএন্ড ক্লায়েন্ট (client, endpoints, zod schemas)
src/lib/auth/       সেশন টোকেন সংরক্ষণ
src/lib/format/     বাংলা অঙ্ক, ফোন, সময়
tests/              Vitest (domain, store, client, bn)
```

### দুই ধরনের ডেটা (গুরুত্বপূর্ণ)
1. **সার্ভারে:** শুধু লগইন, দোকান (store), কর্মচারী। `src/lib/api/*` দিয়ে, `NEXT_PUBLIC_API_URL` (ডিফল্ট লাইভ Supabase `/api`)।
2. **শুধু ফোনের ব্রাউজারে (`localStorage`):** পণ্য, ব্যাচ, বিল, কাস্টমার, বাকির খাতা। কী: `pos.db.v1.<storeId>`, নষ্ট হলে ব্যাকআপ `.corrupt`। **সার্ভার সিংক নেই; ব্রাউজারের ডেটা মুছলে হারায়।** ব্যাকএন্ডে এসবের API এখনো নেই।

### লোকাল ডেটা স্তর
- `domain/` ও `store/actions.ts`-এর সব ফাংশন **বিশুদ্ধ ও immutable**: পুরনো `Db` বদলায় না, নতুন `Db` ফেরত দেয়; ব্যর্থ হলে বাংলা বার্তাসহ `DomainError` ছোঁড়ে।
- `DbProvider` দেয় `{ db, ready, saveFailed, update(fn), run(fn → {db,value}) }`।
- `AppShell` `ready` না হওয়া পর্যন্ত children রেন্ডার করে না। যে পেজ `useState` শুরুতেই `db` পড়ে, সেটিকে `Ready` দিয়ে মুড়তে হবে, নইলে ফাঁকা ডেটায় ইনিশিয়ালাইজ হবে।
- `useSearchParams` ব্যবহার করা পেজ অবশ্যই `Suspense`-এ মোড়া।

## ডোমেইন নিয়ম (ভাঙা যাবে না)
- **টাকা পূর্ণসংখ্যা পয়সায়**, কখনো float নয়। **স্টক পিসে**। কার্টন/বক্স পিসে রূপান্তর হয় `domain/units.ts`-এ।
- বিক্রি **FIFO ব্যাচ** অনুযায়ী (`domain/fifo.ts`); মেয়াদোত্তীর্ণ ব্যাচ বাদ। মেয়াদের শ্রেণি: ≤০ দিন expired, ≤৩০ critical, ≤৯০ soon। মেয়াদ মাসের শেষ তারিখ, `null` = মেয়াদ নেই।
- শতাংশ ছাড় সংরক্ষিত হয় `percent × 100` হিসেবে।
- বিল নম্বর ১০০১ থেকে (`FIRST_BILL_NO = 1000`)। সার্ভার থেকে পাওয়া ডিভাইস কোড (A–Z) উপসর্গ হয়: "A-১০০১" (`domain/bill.ts` `formatBillNo`)। নিবন্ধনের আগের বা অফলাইনে করা বিলে `prefix` নেই। ডিভাইস id/কোড `store/device.ts`-এ, কী `pos.device.v1.<storeId>`; ব্যাকআপে নেই (ব্যাকআপ অন্য ফোনে ফেরালে দুই ফোন এক কোড পেত)। `DeviceRegistrar` লগইনের পর `POST /v1/sync/register-device` ডাকে।
- বাকিতে বিক্রিতে কাস্টমার বাধ্যতামূলক। পেমেন্ট: ক্যাশ ও মোবাইল (বিকাশ/নগদ/রকেট)।
- মোবাইল নম্বর বাংলা বা ইংরেজি অঙ্কে নেওয়া যায়, API-তে ইংরেজি অঙ্ক যায় (`format/phone.ts`)।

## কোড কনভেনশন
- ফাইল kebab-case (`product-form.tsx`), কম্পোনেন্ট PascalCase। `@/*` = `src/*`।
- UI-র সব লেখা বাংলায়; ত্রুটির বার্তায় ব্যবহারকারীকে দোষ দেওয়া নয়, কী করতে হবে তা বলা।
- পেজ ছোট রাখা; হিসাব `domain/`-এ, ডেটা বদল `store/actions.ts`-এ, UI-তে নয়।
- স্ক্যানার: নেটিভ `BarcodeDetector` (সব ব্রাউজারে নেই), না থাকলে হাতে নম্বর লেখা। ইমপোর্ট শুধু CSV।
- প্রিন্ট: `window.print` + `.no-print` CSS; রসিদ শেয়ার `navigator.share`, না থাকলে ক্লিপবোর্ড।
- সার্ভিস ওয়ার্কার শুধু একই origin-এর GET ক্যাশ করে, API কখনো নয়। ক্যাশ কৌশল বদলালে `public/sw.js`-এর `VERSION` বাড়ান।
- সার্ভারের কোনো গোপন তথ্য ফ্রন্টএন্ডে রাখা যাবে না (`NEXT_PUBLIC_*` সবাই দেখে)।
- নিরাপত্তা হেডার (CSP সহ) `public/_headers`-এ। API অন্য origin-এ সরালে সেখানকার `connect-src` বদলাতে হবে। নমুনা-তথ্য বোতাম ডিফল্টে বন্ধ (`NEXT_PUBLIC_ENABLE_DEMO=1` দিলে চালু)। CSV ইমপোর্টের সীমা: ১ MB ও ৫০০০ সারি।
- কমিট: `type: বর্ণনা` (feat, fix, chore, docs, test, refactor)।

## পরিবেশ
`.env.example` দেখুন: শুধু `NEXT_PUBLIC_API_URL` (শেষে `/` ছাড়া)। অন্য origin থেকে চালালে সেটি ব্যাকএন্ডের `ALLOWED_ORIGINS` secret-এ যোগ করতে হবে, নইলে CORS আটকাবে।

## জানা সীমাবদ্ধতা
- ডেটা ফোনে আটকা (ওপরে দেখুন); একাধিক ডিভাইসে মেলে না।
- সেটিংসে ব্যাকআপ নামানো/ফেরানো (`store/backup.ts`) ও সেভ-জায়গার সতর্কতা আছে; একাধিক ট্যাবে অন্য ট্যাবের বদল `storage` ইভেন্টে নেওয়া হয়। বিল কখনো স্বয়ংক্রিয়ভাবে ছাঁটা হয় না, ব্যাকআপ না নিলে `BackupReminder` দিনে একবার মনে করায় (অবস্থা `store/backup-reminder.ts`, Db-র বাইরে), লগইনের পর `StorageGuard` `navigator.storage.persist()` চায় (ফল সেটিংসে), আর অ্যাপ ভাঙলে `error.tsx`/`global-error.tsx`-এর `CrashScreen` থেকে ডেটার কপি নামানো যায় (`store/rescue.ts`), তাই খুব ব্যস্ত দোকানে ব্যাকআপ নিয়মিত নিতে হবে; স্থায়ী সমাধান সার্ভার সিংক।
- UI এখনো আসল ফোনে ম্যানুয়ালি যাচাই হয়নি। CI টাইপ, টেস্ট, বিল্ড ও একটি Playwright E2E (`e2e/`, মোবাইল Chromium, `npm run test:e2e`) চালায়: দোকান খোলা → পণ্য → স্টক → নগদ ও বাকি বিল → রসিদ (বিল নম্বর A-১০০১) → বাকি আদায়। E2E-তে ব্যাকএন্ড নকল (`page.route`), তাই আসল API-র সাথে মেলানো বা লগইন/স্টাফ/ব্যাকআপ-পুনরুদ্ধার/অফলাইন এতে নেই; কম্পোনেন্ট টেস্টও নেই। লোকালে চালাতে: `NEXT_PUBLIC_API_URL=/api npm run build && npx playwright install chromium && npm run test:e2e`।
- `README.md`-র "এখন যা কাজ করে" অংশ পুরনো (শুধু F0/F1 বলে); হালনাগাদ দরকার।
- অ্যাপের নাম ঠিক হয়নি ("দোকান POS"; "Bipon"/"Bipone" বিবেচনায়)।
