# SESSION_STATE — session breakpoint

> **Updated**: 2026-11-17 | **Project**: x-blog
> **Feature list**: `gate/feature_list.json` (status via `python3 gate/pass-gate.py status`; not yet initialized)
> **Rule**: one page max. If this file grows past one page, move finished
> work to `CHANGELOG.md` and keep only the breakpoint here. History is not
> state.

## Goal

- Ship URL navigation page (`/nav` + `/admin/nav`, `apps/api/src/nav`) with category/link CRUD and deploy via `main` (commit `b0deef5`).

## In progress

- none — nav feature merged into `main` (`b0deef5`) and deployed 2026-11-17 (manual deploy, log `deploy-20261117-nav.log`); `/api/nav` returns the seeded 教育优惠 / EduMails link, `/nav` and `/admin/nav` return 200.

## Next

- [ ] Confirm GitHub Actions `.github/workflows/deploy.yml` run succeeds and applies additive migration `20261111060000_add_perks_radar` (`PerkRound`, `PerkSourceRun`, `PerkSourceState`, `PerkItem`).
  - Correction 2026-11-17: this item is stale — perks tables already exist in production and containers were up ~11h on 2026-11-11; the live deploy route is Drone CI auto-deploy on push to `main`, not GitHub Actions (see PROJECT_CONTEXT §2.1). Verify `/admin/perks` in a browser instead.
- [ ] Optionally set `JINA_API_KEY` in GitHub Secrets `BLOG_ENV` if `linuxdo` encounters Jina rate limits.
- [ ] Verify `/admin/perks` in production browser (`https://blog.ulife.vip/admin/perks`): test manual refresh, bookmark/claimed toggles, and confirm 1h/3h scheduled runs.
- [ ] Decide later whether to commit or ignore the remaining local Harness/IDE scaffolding files still untracked in the workspace.
- [ ] Mail baseline moved: 13 QqGroups / 34 mailboxes / auth total 858 as of 2026-11-17 (user added groups 2385651823 and 1458227168 on 2026-11-14, pre-existing in the nav deploy backup). Use this baseline for the next mail deploy check, not 11/28/726.

## Blocked

- Live PostgreSQL `prisma migrate deploy` and real upstream scraping were not run locally (no local PostgreSQL instance running); unit tests mock `PrismaService` and HTTP responses.

## Last verification

- `2026-11-17`: nav release — `npm run test:api` passed (`11 passed, 11 total` suites; `69 passed, 69 total` tests including new `nav.service.spec.ts` 7 tests); `npm run build:web` passed (`/nav` dynamic, `/admin/nav` static, lint & typecheck passed); production deploy log ends “Deployment completed successfully”, new containers up, `/api/nav` public 200 with seeded link, admin mutations unauthenticated 401.
- `2026-11-11`: `prisma validate` & `prisma generate` passed; `npm run test:api` passed (`9 passed, 9 total` suites; `59 passed, 59 total` tests including `perks-parsers.spec.ts` and `perks.service.spec.ts`); `npm run build:api` passed; `npm run build:web` passed (`13/13` pages compiled, lint & typecheck passed).
- Evidence lives in `gate/feature_list.json` (the `evidence` field) and
  `gate/events.jsonl` — not in prose here when the gate is active.
