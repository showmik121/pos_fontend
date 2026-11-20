# Handover QA evidence (frontend side)

QA re-test of 2026-11-20 on `chore/handover` (frontend `fc0bfad`, backend `43e68a1`), Node 24.18 / npm 11.16, Windows 11.
The verdict, score (58/100), blockers and fix prompts are in the backend repo: `pos_backend/docs/handover/handover-evidence/READINESS_REPORT.md`.
This folder holds the frontend-side evidence that report cites.

| File | What it is |
|---|---|
| `handover-evidence/phase1-pos_fontend.txt` | Fresh clone: `npm ci`, typecheck, lint, unit tests + coverage, golden fixtures, `next build` |
| `handover-evidence/phase2-e2e-run1.txt` .. `run3.txt`, `phase2-e2e-build.txt` | Playwright E2E, 3 full runs: 12 passed / 1 skipped / exit 0 each, no flaky tests |
| `handover-evidence/phase2-e2e-INVALID-*.txt` | First three runs, **invalid** (Git Bash rewrote `/api` into a Windows path at build time). Kept for honesty; do not cite |
| `handover-evidence/phase3-browser-qa.txt` | Real-browser walk-through (owner + staff, 375px and 1280px, real backend on a throwaway local Postgres) and the defects found |
| `handover-evidence/phase4-silent-failures.txt` | Static silent-failure review of money / data-loss paths (7 HIGH) |
| `handover-evidence/screens/` | Screenshots and the Lighthouse report for the sale screen |

Notes: all numbers come from one run on one machine. Windows Git Bash users: do not run `NEXT_PUBLIC_API_URL=/api npm run build` (see `CLAUDE.md`); use PowerShell or `MSYS_NO_PATHCONV=1`.
