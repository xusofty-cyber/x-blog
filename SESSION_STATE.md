# SESSION_STATE — session breakpoint

> **Updated**: 2026-11-11 | **Project**: x-blog
> **Feature list**: `gate/feature_list.json` (status via `python3 gate/pass-gate.py status`; not yet initialized)
> **Rule**: one page max. If this file grows past one page, move finished
> work to `CHANGELOG.md` and keep only the breakpoint here. History is not
> state.

## Goal

- Integrate PerkRadar into `x-blog` admin console (`/admin/perks` + `apps/api/src/perks`) with differential refresh intervals (1h fast / 3h slow) and deploy via `main`.

## In progress

- none — `feature/admin-perks-radar` merged into `main` (pending production GitHub Actions deploy & live `/admin/perks` verification).

## Next

- [ ] Confirm GitHub Actions `.github/workflows/deploy.yml` run succeeds and applies additive migration `20261111060000_add_perks_radar` (`PerkRound`, `PerkSourceRun`, `PerkSourceState`, `PerkItem`).
- [ ] Optionally set `JINA_API_KEY` in GitHub Secrets `BLOG_ENV` if `linuxdo` encounters Jina rate limits.
- [ ] Verify `/admin/perks` in production browser (`https://blog.ulife.vip/admin/perks`): test manual refresh, bookmark/claimed toggles, and confirm 1h/3h scheduled runs.
- [ ] Decide later whether to commit or ignore the remaining local Harness/IDE scaffolding files still untracked in the workspace.

## Blocked

- Live PostgreSQL `prisma migrate deploy` and real upstream scraping were not run locally (no local PostgreSQL instance running); unit tests mock `PrismaService` and HTTP responses.

## Last verification

- `2026-11-11`: `prisma validate` & `prisma generate` passed; `npm run test:api` passed (`9 passed, 9 total` suites; `59 passed, 59 total` tests including `perks-parsers.spec.ts` and `perks.service.spec.ts`); `npm run build:api` passed; `npm run build:web` passed (`13/13` pages compiled, lint & typecheck passed).
- Evidence lives in `gate/feature_list.json` (the `evidence` field) and
  `gate/events.jsonl` — not in prose here when the gate is active.
