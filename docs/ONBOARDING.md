# অনবোর্ডিং গাইড: POS (ফ্রন্টএন্ড)

## ১. এক নজরে
বাংলাদেশের ফার্মেসি ও কসমেটিক্স দোকানের মোবাইল-প্রথম POS। ফোনে PWA হিসেবে চলে, UI পুরো বাংলায়, অফলাইনে চলে। মালিক ও কর্মচারী পণ্য ও স্টক সামলান, বিল কাটেন, বাকির খাতা রাখেন, দিনের হিসাব দেখেন। রানবুক: `docs/RUNBOOK.md`; সীমাবদ্ধতা: `pos_backend/docs/handover/KNOWN_LIMITATIONS.md`।

দুটি রিপো মিলে একটি সিস্টেম:

| রিপো | কাজ | কোথায় চলে |
|---|---|---|
| `pos_fontend` (এটি) | UI, লোকাল ডেটা, হিসাবের যুক্তি, সিংক-ক্লায়েন্ট | Netlify (স্ট্যাটিক সাইট) |
| `pos_backend` | লগইন, দোকান, কর্মচারী, ইভেন্ট-লগ API | Supabase Edge Function + PostgreSQL |

## ২. সিস্টেম ম্যাপ

```
ফোনের ব্রাউজার (PWA)
 ├─ পেজ (src/app)  ──►  src/lib/store/actions.ts  ──►  src/lib/domain (বিশুদ্ধ হিসাব)
 │                              │
 │                              ▼
 │               DbProvider (src/components/db-provider.tsx)
 │                 ├─ localStorage  pos.db.v1.<storeId>   ← পণ্য, ব্যাচ, বিল, কাস্টমার, বাকি (আসল কপি)
 │                 ├─ প্রতি বদলে eventsFromChange → outbox (pos.sync.v1.<storeId>)
 │                 └─ SyncRunner: push (outbox) → pull (নতুন ইভেন্ট) → applyEvents (বিশুদ্ধ রিপ্লে)
 │
 └─ src/lib/api  ──HTTPS + Bearer টোকেন──►  Supabase Edge Function  /api/v1/...
                                              └─ PostgreSQL (RLS)  ← লগইন, দোকান, কর্মচারী, sync_events লগ
```

মূল কথা: **ডেটার আসল কপি ফোনে**; প্রতিটি বদল অপরিবর্তনীয় ইভেন্ট হয়ে সার্ভারের লগে যায় (অফলাইনে জমে থাকে)। সার্ভার এখনো লগ থেকে রিপোর্ট বানায় না।

## ৩. এন্ট্রি পয়েন্ট

| কী খুঁজছেন | কোথায় |
|---|---|
| অ্যাপ শুরু, ফন্ট, মেটাডেটা | `src/app/layout.tsx` (ফন্ট `@fontsource/noto-sans-bengali` থেকে) |
| প্রোভাইডার ও service worker নিবন্ধন | `src/components/providers.tsx` (`AuthProvider` > `DbProvider`) |
| লগইন অবস্থা, না থাকলে `/login`-এ পাঠানো | `src/components/auth-provider.tsx`, `app-shell.tsx` |
| মালিক/কর্মচারী ভেদ | `src/lib/hooks/use-session.ts` (`isOwner`); UI-তে ব্যবহার: রিপোর্ট, রসিদ (বাতিল), মেয়াদ (ব্যাচ সরানো), সেটিংস |
| সেশন টোকেন সংরক্ষণ | `src/lib/auth/storage.ts` |
| সার্ভার API ডাকা | `src/lib/api/client.ts`, `endpoints.ts`, `schemas.ts` (zod) |
| লোকাল ডেটার গঠন | `src/lib/store/types.ts`, `db.ts` |
| ডেটা বদলের সব ক্রিয়া (বিশুদ্ধ ফাংশন) | `src/lib/store/actions.ts` |
| প্রশ্ন/হিসাব (মোট, বাকি, মেয়াদ, স্টক কম) | `src/lib/store/selectors.ts` |
| টাকা, ইউনিট, FIFO, কার্ট, মেয়াদ | `src/lib/domain/*` |
| সিংক: ইভেন্ট তৈরি / রিপ্লে / পাঠানো-আনা | `src/lib/sync/diff.ts`, `replay.ts` (+ `schemas.ts` আকার-যাচাই), `engine.ts`, `state.ts` |
| ব্যাকআপ / উদ্ধার / মোছা | `src/lib/store/backup.ts`, `rescue.ts`, `wipe.ts` |
| নিচের ৫ ট্যাব | `src/components/bottom-nav.tsx` |
| অফলাইন ক্যাশ | `public/sw.js`, `public/manifest.webmanifest` |
| নিরাপত্তা হেডার (CSP) | `public/_headers` |

## ৪. ডিরেক্টরি ম্যাপ
```
src/app/            রাউট: login, signup, sell/*, stock/*, products/*, dues/*, reports/*, settings/*
src/components/     AppShell, BottomNav, providers, scanner, product-form, customer-picker, ui/
src/lib/domain/     money, units, dates, expiry, fifo, cart, errors
src/lib/store/      types, db, actions, selectors, csv, seed, search, backup, rescue, wipe
src/lib/sync/       events, diff, replay, schemas, engine, state, seed
src/lib/api/        client, endpoints, schemas
src/lib/format/     bn (বাংলা অঙ্ক), phone, datetime
tests/              Vitest: ২২টি ফাইল, ২৩৫টি টেস্ট (domain, store, sync, golden …)
e2e/                Playwright: sale-flow, critical-flows, qa-375, support
```
ডায়নামিক রাউট নেই (static export); আইডি যায় কোয়েরি প্যারামে (`?id=`, `?product=`, `?barcode=`)।

## ৫. একটি বিক্রির যাত্রা (প্রধান প্রবাহ)
1. `/sell`: পণ্য খুঁজে বা স্ক্যান করে `addToCart` (খসড়া `db.draft`-এ থাকে, পেজ বদলালেও হারায় না)।
2. `/sell/discount`: লাইন বা পুরো বিলে ছাড়; `computeCart` মোট হিসাব করে।
3. `/sell/pay`: ক্যাশ/মোবাইল/বাকি ভাগ করা; বাকি হলে কাস্টমার বাধ্যতামূলক।
4. `completeSale`: **FIFO** ব্যাচ থেকে স্টক কাটে (মেয়াদোত্তীর্ণ বাদ), বিল নম্বর দেয় (ডিভাইস কোডসহ, যেমন `A-১০০১`), বাকি হলে খাতায় লেখে। যেকোনো ভুলে `DomainError` ছোঁড়ে, ডেটা অক্ষত থাকে।
5. `DbProvider` বদলটি `sale_completed` ইভেন্ট করে outbox-এ রাখে; নেট থাকলে ৩ সেকেন্ডের মধ্যে সার্ভারে যায়।
6. `/sell/receipt?id=`: রসিদ, শেয়ার বা প্রিন্ট।

## ৬. ডোমেইন নিয়ম
- টাকা **পূর্ণসংখ্যা পয়সায়**, স্টক **পিসে**; কার্টন/বক্স পিসে রূপান্তর হয় `units.ts`-এ।
- **FIFO:** সবচেয়ে আগে মেয়াদ শেষ হবে এমন ব্যাচ আগে বিক্রি; মেয়াদোত্তীর্ণ কখনো নয় (✅ E2E-তে যাচাই)।
- **মেয়াদ:** মাসের শেষ তারিখ; ≤০ দিন expired, ≤৩০ critical, ≤৯০ soon। ❌ ফোনের ঘড়ি পেছালে এই হিসাব ঠকানো যায়।
- **বাকির খাতা:** কাস্টমারভিত্তিক ledger; বাকিতে বিক্রি বাকি বাড়ায়, জমা নিলে কমে।
- শতাংশ ছাড় `percent × 100` হিসেবে; বিল নম্বর ১০০১ থেকে।
- **গোল্ডেন ফিক্সচার:** `tests/fixtures/domain/*.json` ব্যাকএন্ডের সাথে আচরণ এক রাখে। নিয়ম বদলালে আগে ফিক্সচার, `node scripts/golden-lock.mjs`, তারপর কোড, তারপর দুই রিপোতে কপি।

## ৭. কনভেনশন
- `domain/` ও `store/actions.ts` বিশুদ্ধ ও immutable: নতুন `Db` ফেরত দেয়, পুরনোটা বদলায় না। UI-তে হিসাব নয়।
- ভুলের বার্তা বাংলায়, `DomainError` দিয়ে; ব্যবহারকারীকে দোষ নয়, কী করতে হবে বলুন।
- `useSearchParams` ব্যবহারকারী পেজ `Suspense`-এ মোড়া; `db` পড়ে `useState` শুরু করা পেজ `Ready`-তে মোড়া।
- ফাইল kebab-case, কম্পোনেন্ট PascalCase, `@/*` = `src/*`।
- সার্ভার থেকে আসা ইভেন্ট বিশ্বাস করা হয় না: `sync/schemas.ts`-এ আকার যাচাই; নতুন ফিল্ড/ইভেন্ট-ধরন যোগ করলে ওই ফাইল ও `tests/sync-roundtrip.test.ts` মেলান, নইলে ঠিক ইভেন্টও অন্য ফোনে নীরবে বাদ পড়বে।
- কমিট: `type: বর্ণনা`। কমিটের আগে `npm run typecheck && npm run lint && npm test && npm run build`।
- টেস্ট `tests/*.test.ts` (Vitest), E2E `e2e/*.e2e.ts` (Playwright); লজিক বদলালে আগে টেস্ট।

## ৮. প্রথম দিন
```bash
git clone https://github.com/showmik121/pos_fontend && cd pos_fontend
npm ci                      # লকফাইল কমিট করা আছে; npm install নয়
npm run dev                 # http://localhost:3000
npm run typecheck && npm run lint && npm test    # ২৩৫টি ইউনিট-টেস্ট
npm run build               # স্ট্যাটিক সাইট -> out/
npx playwright install chromium                  # শুধু প্রথমবার, E2E-র জন্য
```
- ✅ পরিষ্কার ক্লোনে এই ধাপগুলো এক চেষ্টায় পাস (২০২৬-১১-২০; প্রমাণ `pos_backend/docs/handover/handover-evidence/`)।
- শুরুতে ডেটা খালি। লগইনের পর সেটিংসের "নমুনা তথ্য দিয়ে দেখুন" (`NEXT_PUBLIC_ENABLE_DEMO=1` দিলে) ৮টি পণ্য ও ৩ জন কাস্টমার আনে।
- **E2E চালাতে:** `/api`-সহ বিল্ড লাগে: **PowerShell-এ** `$env:NEXT_PUBLIC_API_URL="/api"; npm run build`, তারপর `npm run test:e2e`। **Windows Git Bash-এ `NEXT_PUBLIC_API_URL=/api npm run build` নয়**, MSYS `/api`-কে `C:/Program Files/Git/api` বানিয়ে ফেলে।

## ৯. জানা সীমাবদ্ধতা ও পরের কাজ
সম্পূর্ণ তালিকা: `pos_backend/docs/handover/KNOWN_LIMITATIONS.md`। ডেভেলপারের জন্য শীর্ষ কয়টি:
- ডেটা `localStorage`-এ (~৫ MB সীমা, প্রতি বদলে পুরো ডেটা আবার সেভ): ব্যস্ত দোকানে কয়েক সপ্তাহে ভরার ঝুঁকি। IndexedDB-তে সরানোর পরিকল্পনা আছে (লেখা হয়েছে, বাস্তবায়ন হয়নি)। সিংক-কিউও (`pos.sync.v1`) একই কোটায়।
- ❌ কর্মচারী UI ও সিংকে ক্রয়মূল্য দেখতে পায়; ❌ ঘড়ি পেছালে মেয়াদোত্তীর্ণ ব্যাচ বিক্রি-যোগ্য; এ দুটির `test.fail` E2E আছে (`E2E_EXPECT_FIXED=1` চালিয়ে দেখুন)।
- আংশিক ফেরত/রিফান্ড, MRP, সরবরাহকারী-ক্রয়, ক্যাশ-সেশন, থার্মাল প্রিন্টার, VAT/Mushak নেই (PRD-র P0 ফাঁক: `pos_backend/docs/handover/GAP_ANALYSIS.md`)।
- আসল ফোনে ম্যানুয়াল পরীক্ষা নেই; কম্পোনেন্ট টেস্ট নেই; ক্যামেরা-স্ক্যান ব্রাউজারের `BarcodeDetector`-এর ওপর নির্ভর করে (সব ব্রাউজারে নেই)।
