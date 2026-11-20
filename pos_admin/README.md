# pos_admin

Bipone platform admin panel: a Next.js static export (English UI) for operators only. It talks to `/v1/admin/*` on the backend (`pos_backend`). Shop owners never see it.

## Commands
```bash
npm ci
npm run dev          # http://localhost:3100
npm run typecheck && npm run lint && npm test
npm run build        # next build + scripts/csp-headers.mjs (writes out/_headers, fails on inline styles)
npm run test:e2e     # Playwright against out/ with mocked API replies (needs: npx playwright install chromium)
npm run contract:lock
```

## Environment
- `NEXT_PUBLIC_ADMIN_API_URL`: backend API origin plus path, no trailing slash.
- `ADMIN_API_ORIGIN`: the same origin; becomes the CSP `connect-src` at build time. They must match or the browser blocks every call.

## Contract
`src/contract/admin-api.ts` and `src/domain/admin-permissions.ts` are byte-identical copies from `pos_backend` (the source of truth). `contract.lock` pins both with a sha256; `tests/contract-lock.test.ts` fails on drift. After changing them in the backend run `npm run contract:lock` there and copy the two files and `contract.lock` here.

## Security notes
- The admin token is kept in memory only; reloading the page signs out.
- Strict CSP is generated at build time (hashed inline scripts, no inline styles). It only applies if the host serves `out/_headers` (Cloudflare Pages / Netlify). Hosting and access control (Cloudflare Access or an IP allow-list) are still undecided; do not expose this site before that is settled.
- Server messages are never shown raw; `friendlyError` maps error codes to short sentences.

## Known limits
- The e2e tests mock the API; there is no end-to-end run against the real backend yet.
- The 2FA enrolment screen shows the setup key and otpauth link as text (no QR code).
