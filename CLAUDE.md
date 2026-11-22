# pos_fontend — CLAUDE.md

বাংলাদেশের ফার্মেসি ও কসমেটিক্স দোকানের **মোবাইল-প্রথম POS (PWA)**। UI সম্পূর্ণ বাংলায়। ব্যাকএন্ড আলাদা রিপো: `showmik121/pos_backend` (Supabase Edge Function + PostgreSQL)।

## স্ট্যাক
Next.js 15 (App Router, `output: "export"`, `trailingSlash`) · React 19 · TypeScript strict (`noUncheckedIndexedAccess`) · Tailwind v4 (`@theme` টোকেন `src/app/globals.css`-এ) · zod · Vitest · হাতে লেখা `public/sw.js` · Noto Sans Bengali। Node >= 20।

## কমান্ড
```bash
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (next/core-web-vitals + next/typescript, eslint.config.mjs)
npm test            # vitest run
npm run build       # স্ট্যাটিক সাইট -> out/
```
CI (`.github/workflows/ci.yml`): `npm ci` → typecheck → lint → test → build; আলাদা জব `audit` (`npm audit --omit=dev --audit-level=high`, কমিট করা `package-lock.json` থেকে), `e2e`, `e2e-real`। কমিটের আগে typecheck, lint, test, build পাস করাতে হবে। `package-lock.json` কমিট করা আছে; নতুন প্যাকেজ যোগ করলে `npm install <pkg>` চালিয়ে লকফাইলসহ কমিট করুন। `e2e-real` ব্যাকএন্ডেও `npm ci` চালায়, তাই ব্যাকএন্ড main-এ লকফাইল থাকতে হবে।

## আর্কিটেকচার
পুরো অ্যাপ ক্লায়েন্ট-সাইড; কোনো সার্ভার রানটাইম নেই। Netlify-তে স্ট্যাটিক হোস্ট (`https://bipone.netlify.app/`)।

```
src/app/            রাউট। ডায়নামিক সেগমেন্ট নেই (static export), তাই ?id= / ?product= / ?barcode= কোয়েরি প্যারাম
src/components/     AppShell, BottomNav, providers, scanner, product-form, customer-picker, ui/
src/lib/domain/     বিশুদ্ধ হিসাব: money, units, dates, expiry, fifo, cart, errors
src/lib/store/      লোকাল ডেটা: types, db, actions, selectors, csv, seed, search
src/lib/sync/       সিংক: events (বিল্ডার), replay (applyEvents), diff (স্থানীয় বদল → ইভেন্ট), seed (পুরনো ডেটা → ইভেন্ট), engine (runSync: পুশ → পুল), state (কিউ/কার্সর), ids
src/lib/api/        ব্যাকএন্ড ক্লায়েন্ট (client, endpoints, zod schemas)
src/lib/auth/       সেশন টোকেন সংরক্ষণ
src/lib/format/     বাংলা অঙ্ক, ফোন, সময়
tests/              Vitest (domain, store, client, bn)
```

### দুই ধরনের ডেটা (গুরুত্বপূর্ণ)
1. **সার্ভারে:** শুধু লগইন, দোকান (store), কর্মচারী। `src/lib/api/*` দিয়ে, `NEXT_PUBLIC_API_URL` (ডিফল্ট লাইভ Supabase `/api`)।
2. **শুধু ফোনের ব্রাউজারে (`localStorage`):** পণ্য, ব্যাচ, বিল, কাস্টমার, বাকির খাতা। কী: `pos.db.v1.<storeId>`, নষ্ট হলে ব্যাকআপ `.corrupt`। **সিংক (নিচে) ডেটা সার্ভারের ইভেন্ট-লগে পাঠায়, তবু ব্যাকআপ নেওয়া ভালো।**

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
- স্টক থেকে ব্যাচ সরানো (`removeBatch`) কারণ বাধ্যতামূলক এবং `Db.removedBatches`-এ (ঐচ্ছিক ফিল্ড, পুরনো ডেটায় নেই) কে/কখন/কেন/কত পিস/কেনা দাম লেখে; মেয়াদ পেজে খাতা ও মোট ক্ষতি দেখায়, ব্যাকআপেও যায়।
- লগআউটে ডেটা ফোনে থাকে (ডিফল্ট); সেটিংসের লগআউট শিটে "ডেটা মুছুন" বিকল্প আছে (`store/wipe.ts`): ব্যাকআপ নামানো ও নিশ্চিতকরণ বাধ্যতামূলক, ডিভাইস কোডও মোছে (নইলে একই উপসর্গে বিল নম্বর আবার ১০০১ থেকে শুরু হতো)।
- বাকিতে বিক্রিতে কাস্টমার বাধ্যতামূলক। পেমেন্ট: ক্যাশ ও মোবাইল (বিকাশ/নগদ)। নতুন বিলে রকেট বাছা যায় না (UI `PAY_METHODS`); `MobileMethod`-এ `rocket` রয়ে গেছে শুধু পুরনো বিল/সিংক-ডেটা পড়তে, রসিদ ও রিপোর্টে লেবেল আছে। পেমেন্ট পাতা (`sell/pay`): ক্যাশ/বিকাশ/নগদ টাইল (`components/pay/method-tiles.tsx`) + পাওয়া টাকার ঘর (ডিফল্ট পুরো মোট) + দ্রুত অঙ্ক (`domain/pay-entry.ts` `quickCashAmounts`) + "পুরোটা বাকি"; ক্যাশ-মোবাইল মিলিয়ে নিতে "ভাগ করে নিন" মোড। ঘর থেকে পরিমাণ বের করে `resolveEntry` (বিশুদ্ধ), হিসাব `settlePayments`।
- মোবাইল নম্বর বাংলা বা ইংরেজি অঙ্কে নেওয়া যায়, API-তে ইংরেজি অঙ্ক যায় (`format/phone.ts`)।

### গোল্ডেন ফিক্সচার (ব্যাকএন্ডের সাথে আচরণ এক রাখা)
- `tests/fixtures/domain/*.json` (ছাড়, পেমেন্ট, FIFO, মেয়াদ, ইউনিট) এই রিপোর `src/lib/domain`-এর আচরণ লিখে রাখে; `tests/golden.test.ts` চালায়। ব্যাকএন্ড (`showmik121/pos_backend` `tests/fixtures/domain/`) একই JSON চালায়।
- ডোমেইন-যুক্তি বদলালে: আগে ফিক্সচার বদলান (লাল), তারপর কোড; `node scripts/golden-lock.mjs` চালিয়ে `fixtures.lock` নতুন করুন, তারপর JSON-গুলো ও `fixtures.lock` ব্যাকএন্ডে কপি করুন। দুই রিপোর লক একই না হলে আচরণ সরে গেছে।

### সিংক (ইভেন্ট-লগ, ধাপ ২–৩)
- `applyEvents(db, events)` বিশুদ্ধ: `{db, deferred, ignored}` ফেরায়। একই ইভেন্ট আবার দিলে কিছু বদলায় না; ক্রম যাই হোক ফল এক (ইভেন্ট `at`, তারপর id দিয়ে সাজানো)।
- ধরন: `product_upserted`, `stock_in`, `customer_upserted`, `sale_completed`, `sale_voided`, `due_received`, `batch_removed`, `settings_updated`। ডিলারের পাওনা খাতা (`dealers`/`dealerEntries`, `store/dealers.ts`, মালিক-মাত্র UI): `dealer_upserted`, `dealer_entry_upserted`, প্রতিটি লেনদেন আলাদা রেকর্ড (শেষ-বদল জেতে), তাই দুই ফোনের এন্ট্রি যোগ হয়। অচেনা ধরন `ignored` (ভবিষ্যৎ সামঞ্জস্য)।
- পণ্য/কাস্টমার/সেটিংসে শেষ-বদল জেতে (`Db.sync.clocks`, মান `<at>|<id>`)। স্টক-জমা যোগাত্মক, ব্যাচের `rcpt`-এ ইভেন্ট id রেখে দুবার গোনা আটকায়। বিক্রি বিল id দিয়ে একবারই; ব্যাচ না আসা পর্যন্ত বিক্রি, আর বিল না আসা পর্যন্ত বাতিল `deferred` থাকে (ধাপ ৩-এ ডিভাইসে রেখে আবার দিতে হবে)।
- বাতিলে বাকি-ফেরানো খাতার id স্থির `void:<saleId>`, তাই দুই ডিভাইসে বাতিল হলেও একবারই কমে। সরানো ব্যাচ (`RemovedBatch.batchId`) পরে আসা স্টক-জমায় ফেরে না।
- জানা সীমা: দুই ডিভাইসে একই ব্যাচ থেকে বেশি বিক্রি হলে `qtyRemaining` ঋণাত্মক হতে পারে (ছাঁটা হয় না, নইলে ক্রম-নির্ভর হতো)। `billCounter` রিপ্লেতে বদলায় না। সার্ভার কর্মচারীকে শুধু পণ্য/স্টক-জমা/কাস্টমার/বিক্রি/বাকি-আদায় পাঠাতে দেয়; বাকি ধরন (বাতিল, সেটিংস, ব্যাচ সরানো) মালিক-মাত্র। কর্মচারীর সেশনে ৪০৩ `forbidden` এলে ইভেন্ট কিউতে আটকে থাকে, বাদ যায় না (ফোনের কিউ দোকান-ভিত্তিক, তাই মালিকের কিউ-করা ইভেন্ট পরে মালিক সিংক করলে যায়; `engine.ts` `isForbidden`)। ব্যাচ সরানোর বোতাম তাই শুধু মালিককে দেখানো হয়। সার্ভার থেকে আসা পেলোডের আকার `sync/schemas.ts`-এ যাচাই হয় (শুধু গ্রহণ/বর্জন, ডেটা বদলায় না); বিকৃত ইভেন্ট `ignored` হয় এবং ছুঁড়লেও বাকি ইভেন্ট চলে। নতুন ফিল্ড/ধরন যোগ করলে `schemas.ts` ও `tests/sync-roundtrip.test.ts` মেলাতে হবে, নইলে ঠিক ইভেন্টও অন্য ডিভাইসে নীরবে বাদ পড়বে। সিংক-পূর্ব পুরনো ব্যাচে `rcpt` নেই: আগের ডেটা ইভেন্টে তোলার সময় (ধাপ ৩) একই স্টক দুবার না ধরার ব্যবস্থা লাগবে।
- `stockIn`-এ `receiptId` দিলে ব্যাচে `rcpt` লেখা হয়।
- **ইভেন্ট তৈরি:** UI/অ্যাকশনে হাত দেওয়া হয় না। `DbProvider.commit` প্রতি স্থানীয় বদলে `eventsFromChange(আগে, পরে)` চালায়, ইভেন্ট `outbox`-এ যায় এবং `Db`-তে ঘড়ি/`rcpt` বসে (নিজের ইভেন্ট ফিরে এলে দ্বিগুণ হয় না)। সার্ভার থেকে আসা বদল `syncNow`-এর মাধ্যমে বসে, ইভেন্ট বানায় না।
- **অবস্থা:** `pos.sync.v1.<storeId>` (`sync/state.ts`; সত্য-উৎস localStorage, ব্যাকআপে নেই, লগআউট-মোছায় যায়): `cursor`, `outbox`, `deferred`, `dropped`, `seeded`। প্রথমবার লোডে `seedEvents` পুরনো ডেটা স্থির-id ইভেন্টে তোলে (দুই ফোন একই ডেটা পাঠালেও স্টক দ্বিগুণ হয় না)।
- **চালানো:** `SyncRunner` খোলার সময়, প্রতি মিনিটে, `online`/অ্যাপে ফিরলে ও বদলের ৩ সেকেন্ড পরে `runSync` ডাকে (আগে ডিভাইস নিবন্ধন)। আগে পুশ (১০০ ইভেন্ট/৩০০ KB দল), পরে পুল (২০০/পাতা)। নেটওয়ার্ক/৫xx/৪০১ হলে থামে, কিউ থাকে। ৪০০/৪১৩ হলে দল ভেঙে একটি একটি করে পাঠিয়ে খারাপটি `dropped` গোনে; `device_unregistered` ত্রুটিতে ইভেন্ট বাদ যায় না।
- সেটিংসে `SyncStatus` বাকি/শেষ সিংক দেখায়।

### ক্র্যাশ রিপোর্ট (নিজের সার্ভারে)
- রেন্ডার ত্রুটি (`error.tsx`/`global-error.tsx` → `CrashScreen`) ও পাতার বাইরের ত্রুটি (`CrashReporter`: `window.error`, `unhandledrejection`) `reportCrash` (`lib/report/send.ts`) দিয়ে `POST /v1/client-errors`-এ যায়; শুধু প্রোডাকশনে, টোকেন ছাড়া, ব্যর্থ হলে চুপ।
- `report/crash-report.ts` বিশুদ্ধ: বার্তা ৫০০/স্ট্যাক ৪০০০ অক্ষরে ছাঁটা, ৬+ অঙ্কের সংখ্যা (বাংলা/ইংরেজি) `#` হয়, পথ থেকে `?`/`#` কাটা। এক সেশনে একই ত্রুটি একবার, মোট ৩টি (`sessionStorage`); এক্সটেনশন/অন্য-origin স্ক্রিপ্ট ও `ResizeObserver` বার্তা বাদ। সার্ভারেও IP-প্রতি ১০/ঘণ্টা, মোট ১০০/ঘণ্টা।
- সংস্করণ: `NEXT_PUBLIC_APP_VERSION` = বিল্ডের কমিট (`next.config.mjs`)। রিপোর্ট দেখা: ব্যাকএন্ড RUNBOOK ৮ক।

## কোড কনভেনশন
- ফাইল kebab-case (`product-form.tsx`), কম্পোনেন্ট PascalCase। `@/*` = `src/*`।
- UI-র সব লেখা বাংলায়; ত্রুটির বার্তায় ব্যবহারকারীকে দোষ দেওয়া নয়, কী করতে হবে তা বলা।
- পেজ ছোট রাখা; হিসাব `domain/`-এ, ডেটা বদল `store/actions.ts`-এ, UI-তে নয়।
- স্ক্যানার: নেটিভ `BarcodeDetector` (সব ব্রাউজারে নেই), না থাকলে হাতে নম্বর লেখা। ইমপোর্ট শুধু CSV।
- প্রিন্ট: `window.print` + `.no-print` CSS; রসিদ শেয়ার `navigator.share`, না থাকলে ক্লিপবোর্ড।
- সার্ভিস ওয়ার্কার শুধু একই origin-এর GET ক্যাশ করে, API কখনো নয়। শুধু সফল (২xx) উত্তর ক্যাশ হয়; পেজ ৬০ ও অ্যাসেট ১৫০ এন্ট্রির সীমা (পুরনো আগে যায়, `tests/sw.test.ts`)। ক্যাশ কৌশল বদলালে `public/sw.js`-এর `VERSION` বাড়ান।
- সার্ভারের কোনো গোপন তথ্য ফ্রন্টএন্ডে রাখা যাবে না (`NEXT_PUBLIC_*` সবাই দেখে)।
- নিরাপত্তা হেডার (CSP সহ) `public/_headers`-এ। API অন্য origin-এ সরালে সেখানকার `connect-src` বদলাতে হবে। নমুনা-তথ্য বোতাম ডিফল্টে বন্ধ (`NEXT_PUBLIC_ENABLE_DEMO=1` দিলে চালু)। CSV ইমপোর্টের সীমা: ১ MB ও ৫০০০ সারি।
- কমিট: `type: বর্ণনা` (feat, fix, chore, docs, test, refactor)।

## পরিবেশ
`.env.example` দেখুন: শুধু `NEXT_PUBLIC_API_URL` (শেষে `/` ছাড়া)। অন্য origin থেকে চালালে সেটি ব্যাকএন্ডের `ALLOWED_ORIGINS` secret-এ যোগ করতে হবে, নইলে CORS আটকাবে।

## জানা সীমাবদ্ধতা
- ডেটা ফোনে আটকা (ওপরে দেখুন); একাধিক ডিভাইসে মেলে না।
- সেটিংসে ব্যাকআপ নামানো/ফেরানো (`store/backup.ts`) ও সেভ-জায়গার সতর্কতা আছে; একাধিক ট্যাবে অন্য ট্যাবের বদল `storage` ইভেন্টে নেওয়া হয়। বিল কখনো স্বয়ংক্রিয়ভাবে ছাঁটা হয় না, ব্যাকআপ না নিলে `BackupReminder` দিনে একবার মনে করায় (অবস্থা `store/backup-reminder.ts`, Db-র বাইরে), লগইনের পর `StorageGuard` `navigator.storage.persist()` চায় (ফল সেটিংসে), আর অ্যাপ ভাঙলে `error.tsx`/`global-error.tsx`-এর `CrashScreen` থেকে ডেটার কপি নামানো যায় (`store/rescue.ts`), তাই খুব ব্যস্ত দোকানে ব্যাকআপ নিয়মিত নিতে হবে; স্থায়ী সমাধান সার্ভার সিংক।
- UI এখনো আসল ফোনে ম্যানুয়ালি যাচাই হয়নি। CI টাইপ, টেস্ট, বিল্ড ও একটি Playwright E2E (`e2e/`, মোবাইল Chromium, `npm run test:e2e`) চালায়: দোকান খোলা → পণ্য → স্টক → নগদ ও বাকি বিল → রসিদ (বিল নম্বর A-১০০১) → বাকি আদায়। E2E দুই জবে চলে: `e2e` (ব্যাকএন্ড নকল, `page.route`) আর `e2e-real` (`E2E_REAL=1`; `showmik121/pos_backend` main চেকআউট + Postgres 16 + `pos_app`, আলাদা origin-এ, তাই API চুক্তি, CORS, ডিভাইস কোড ও লগআউট/লগইন/ভুল পাসওয়ার্ড/একই নম্বরে দ্বিতীয় দোকান আটকানো যাচাই হয়)। ব্যাকএন্ড main বদলালে `e2e-real` ভাঙতে পারে (ইচ্ছাকৃত: ভাঙন আগে ধরা পড়ে); স্থির করতে ci.yml-এ `ref`-এ কমিট SHA বসান। `e2e/critical-flows.e2e.ts` (নকল API, `e2e/support.ts` দিয়ে দোকানের সেশন ও ডেটা localStorage-এ বসানো) অফলাইনে বিক্রি → সিংক, ব্যাকআপ → মোছা → ফেরানো (ভুল ফাইল আটকানোসহ), মালিক বনাম কর্মচারীর পাতা (বাতিল/রিপোর্ট/ব্যাচ সরানো), এবং মেয়াদোত্তীর্ণ ব্যাচ কখনো বিক্রি না হওয়া যাচাই করে; `e2e/qa-375.e2e.ts` ৩৭৫px-এ সব পাতা ও শিট ঘুরে উপচে পড়া/ত্রুটি/ভাঙা অ্যাসেট ধরে এবং বাকি পর্যবেক্ষণ (ছোট ট্যাপ-জায়গা, লেবেল, ছোট লেখা, `npm i --no-save axe-core` থাকলে WCAG) `QA_OUT/findings.json`-এ লেখে। দুটি জানা ত্রুটি `test.fail` চিহ্নিত (কর্মচারীর UI-তে ক্রয়মূল্য দেখা যায়; ফোনের ঘড়ি পেছালে মেয়াদোত্তীর্ণ ব্যাচ বিক্রি-যোগ্য হয়): `E2E_EXPECT_FIXED=1 npx playwright test` চালালে সেগুলো সাধারণ টেস্ট হয়ে আসল ব্যর্থতা দেখায়; ঠিক হলে চিহ্ন সরান। **Windows Git Bash-এ `NEXT_PUBLIC_API_URL=/api npm run build` চালাবেন না**: MSYS `/api`-কে `C:/Program Files/Git/api` বানিয়ে বান্ডলে বসায়, ফলে সব API-ডাক নেটওয়ার্ক-ত্রুটিতে ব্যর্থ হয়; PowerShell-এ (`$env:NEXT_PUBLIC_API_URL="/api"`) বা `MSYS_NO_PATHCONV=1` দিয়ে চালান। প্রথমবার `npx playwright install chromium`। কম্পোনেন্ট টেস্ট নেই। লোকালে (নকল): `NEXT_PUBLIC_API_URL=/api npm run build && npx playwright install chromium && npm run test:e2e`।
- অ্যাপের নাম "Bipone" (ইংরেজি, সব জায়গায়); লোগো "ব" অক্ষর + বারকোড। নাম বদলাতে `src/components/logo.tsx`-এর `APP_NAME`, `layout.tsx`, `manifest.webmanifest`।
- ল্যান্ডিং: লগইন না থাকলে `/` ল্যান্ডিং দেখায় (`components/landing/`; লেখা `landing-content.ts`-এ, শুধু অ্যাপে যা সত্যিই আছে তাই লিখবেন)। হোম-স্ক্রিন থেকে ইনস্টল-করা অ্যাপ খুললে সরাসরি `/login`-এ যায়। লগইন/সাইনআপ `components/auth-shell.tsx` ব্যবহার করে।
- ইনস্টল (PWA): `lib/pwa/install.ts` `beforeinstallprompt` অ্যাপ লোডের শুরুতেই ধরে রাখে (`providers.tsx` থেকে import); `components/use-install.ts` হুক ভিতরের `InstallBanner` ও ল্যান্ডিংয়ের `InstallButton`/`InstallSection` দুটোই ব্যবহার করে। ব্রাউজার ইনস্টল-ইভেন্ট না দিলে (iOS Safari, Firefox) ল্যান্ডিংয়ে হাতে করার ধাপ দেখায়।
- হোমের হেডার: `components/home-header.tsx` (শুভেচ্ছা `greetingBn`, দোকানের নাম, সেটিংস) + দোকানের ধরন (`store.kind`) অনুযায়ী ছবি: `public/art/home-hero.webp` (ফার্মেসি), `home-hero-cosmetics.webp` (কসমেটিক্স), `home-hero-retail.webp` (অন্যান্য/জেনারেল স্টোর), সব জলরঙের শহুরে ছবি 2:1, 1200×600; ছাদে Bipone বিলবোর্ড, দোকানের সামনে মাল-নামানো ভ্যান; ছবি বদলাতে একই মাপ ও ওপর-ডানে বিলবোর্ডের জায়গা রাখুন; বাছাই `.home-hero[data-kind]` CSS-এ, `AppShell`-এর `hero` প্রপ দিয়ে সাধারণ হেডারের বদলে বসে। `themeColor`/manifest `theme_color` (#E8DCCB) হেডারের ওপরের রঙের সাথে মেলানো, বদলালে `.home-hero` গ্রেডিয়েন্টও বদলান। `public/art/city-3shops.svg` (স্কেচ স্কাইলাইন, `scripts/art/city-sketch.mjs`) লগইন/ল্যান্ডিংয়ে।
- হোমের নকশা (`src/app/page.tsx` + `components/home/`): বড় "নতুন বিল" কার্ড (`/sell?scan=1` স্ক্যান শর্টকাট), `TodayCard` (গতকালের তুলনা `store/home-stats.ts` `changePercent`, ৭ দিনের চার্ট `dailyTotals`, নগদ/মোবাইল/বাকি), `QuickActions` ছোট (৭৬px) দুই-কলাম কার্ড-গ্রিড (শুধু যা নিচের মেনুতে নেই: মেয়াদ, নোট; মালিক-মাত্র: খরচ, ডিলার; বেজোড় হলে শেষটি পুরো চওড়া; বাকি আদায়/রিপোর্ট/স্টক জমা মেনু ও স্টক পাতায় আছে বলে এখানে নেই), পাশে-টানা `AlertCards`। ত্রিমাত্রিক আইকন `components/ui/sticker-icons.tsx` (নিজেদের আঁকা এসভিজি, কার্ডের কোণে নরম রঙিন আভার ওপর; লাল ব্যাজ `bg-alert` শুধু খবর থাকলে); নিচের মেনুর ২৪px আইকন `ui/nav-icons.tsx` (দুই-সুর রেখাচিত্র), মাঝখানে উঁচু বিল বোতাম, বাকির ট্যাবে সংখ্যার ব্যাজ। চাপ-সাড়া `.press` (`globals.css`, অ্যানিমেশন-কমানোয় বন্ধ)। নতুন আইকন যোগ করলে ছোট (২৪px) জায়গায় রেখাচিত্র, বড় টাইলে ত্রিমাত্রিক ব্যবহার করুন।
- রঙের নকশা "আম" (`globals.css` `@theme`): আমপাতা-সবুজ ব্র্যান্ড, পাকা-আমের সোনালি জোর (হিরো কার্ড), আম-ক্রিম ক্যানভাস।
