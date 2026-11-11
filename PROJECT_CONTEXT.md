# Project Context & Durable Facts (PROJECT_CONTEXT.md)

> **Role & Purpose**: This document records core architectural facts and durable engineering constraints for `x-blog`, serving as the single source of truth (SSOT) when AI Agents start sessions and make technical decisions. Maintain only when system architecture, stack choices, persistence designs, or global guardrails change significantly. Session-specific transient status and breakpoints belong in `SESSION_STATE.md`.

---

## 1. Project Overview & Core Domain

- **System Name**: `x-blog`
- **Domain**: Full-stack personal/technical blog platform (Swiss Modernism 2.0 editorial style) with an integrated admin console for content, media storage, site settings, and multi-mailbox IMAP viewing.
- **Core Feature Matrix**:
  1. **Public Blog & Content Delivery (`apps/web`)**: Server-rendered (`force-dynamic`) home feed with pinned posts, post detail pages (`/posts/[slug]`) with reading progress and view counting (`POST /api/posts/:slug/view`), category aggregation (`/categories`, `/categories/[slug]`), search (`/search`), static `/about`, RSS 2.0 (`/rss.xml`), `/sitemap.xml`, and `POST /preview` Markdown rendering.
  2. **Sanitized Markdown Pipeline (`apps/web/lib/markdown.ts`)**: `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-raw` + `rehype-sanitize` (extending `defaultSchema` for `video`/`source` and code/table attributes) + `rehype-stringify`.
  3. **Admin Console & Content Management (`apps/web/app/admin`, `apps/api/src/{auth,posts,categories,tags,settings}`)**: JWT-authenticated (`xblog_token` in `localStorage`, 7-day expiry) admin UI for dashboard stats, posts CRUD (draft/published/pinned), categories, tags, and site hero settings (`heroTagline`, `heroEyebrow`).
  4. **Media Upload & Quota Management (`apps/api/src/uploads`, `apps/web/app/admin/media`)**: Authenticated upload/list/delete for images (`png/jpg/jpeg/gif/webp`) and videos (`mp4/webm`) written directly to `UPLOAD_DIR` (`/data/blog-img`, host `/var/www/blog-img`), 100MB per-file Multer limit, configurable total quota (`UPLOAD_TOTAL_LIMIT_MB`, default `5120`).
  5. **Multi-Account Mail Viewer (`apps/api/src/mail`, `apps/web/app/admin/mail`)**: Admin-only on-demand IMAP reader (`imapflow` + `mailparser`) supporting QQ groups (up to 3 aliases: `numeric`, `letter`, `foxmail` sharing one group auth code) and 163 mailboxes (`imap.163.com:993`, 1 mailbox/group), AES-256-GCM encrypted auth codes (`MAIL_ENCRYPTION_KEY`), message list/search/read/delete, attachment download (<= 30MB), and unified recent inbox (`GET /api/mail/recent`) with within-group deduplication (`unified-dedupe.ts`).
  6. **Admin Perks Radar (`apps/api/src/perks`, `apps/web/app/admin/perks`)**: Admin-only deal/freebie aggregator inspired by `luobinger/PerkRadar` (`JwtAuthGuard`, not exposed publicly). Fetches 7 fixed feeds with differential intervals (`fast` 1h: `linuxdo`, `v2ex`, `nodeseek`; `slow` 3h: `epic`, `appinn`, `ghxi`, `iplaysoft`), conditional HTTP (`ETag`/`Last-Modified` 304), `allowedHosts` link filtering, 7-day unbookmarked retention, and PostgreSQL-persisted bookmark/claimed states.

---

## 2. Repository & Technology Stack

### 1. Environment & Branches
- **Repository**: `git@github.com:xusofty-cyber/x-blog.git`
- **Primary / Working Branch**: `main` (protected; develop on short-lived feature/fix branches)
- **Runtime & Deployment**: Docker Compose (`node:22-alpine` multi-stage images) behind host Nginx SSL gateway (`blog.ulife.vip` -> `127.0.0.1:13100`), deployed via GitHub Actions (`.github/workflows/deploy.yml`) + `deploy/deploy.sh` over SSH.

### 2. Stack Choices

| Layer / Domain | Tech & Version | Notes & Key Libraries |
|---|---|---|
| **Core Language / Runtime** | TypeScript `^5.4.5` / Node.js `22` (Docker) | npm workspaces monorepo (`apps/*`) |
| **Frontend (`@x-blog/web`)** | Next.js `^15.1.7` (App Router) + React `^19.0.0` | Tailwind CSS `^3.4.17`, `@tailwindcss/typography`, `lucide-react`, `unified` / `remark` / `rehype`, `standalone` output |
| **Backend (`@x-blog/api`)** | NestJS `^10.3.8` | `class-validator`, `class-transformer`, `passport-jwt`, `bcryptjs`, `multer` `^2.5.0`, `imapflow` `^1.0.0`, `mailparser` `^3.7.0`, `fast-xml-parser` |
| **Persistence & ORM** | PostgreSQL 16 + Prisma `^5.14.0` | External `nexasx-postgres` container on `nexasx-internal` Docker network, DB `x_blog` |
| **Testing** | Jest `^29.7.0` (`ts-jest`) | Backend unit specs under `apps/api/src/**/*.spec.ts` |

---

## 3. Architecture & Structural Design

- **Architecture Pattern**: Two-service npm workspaces monorepo (`web` + `api`) with single-ingress reverse proxy topology:
  - Browser -> Host Nginx (`HTTPS:443`) -> `web` (`127.0.0.1:13100 -> 3000`) -> `/api/:path*` rewritten or SSR-fetched via `API_INTERNAL_URL` (`http://api:4000`) -> `api` (`expose: 4000`, no host ports) -> `nexasx-postgres:5432` (`nexasx-internal`).
- **Directory & Module Responsibilities**:
  - `apps/api/src/`: Modular NestJS backend (`auth`, `posts`, `categories`, `tags`, `settings`, `uploads`, `mail`, `perks`, `health`, `prisma`, `common`), global prefix `/api`, global `ValidationPipe` (`whitelist: true`, `transform: true`).
  - `apps/api/prisma/`: `schema.prisma`, `seed.ts`, and 7 PostgreSQL migrations under `migrations/`.
  - `apps/web/`: Next.js App Router pages (`app/`), shared UI components (`components/`), SSR fetch & Markdown helpers (`lib/`).
  - `deploy/`: `deploy.sh`, `nginx-blog.conf.example`, `nginx-switch.sh`, `GITHUB_ACTIONS_SETUP.md`.
  - `docs/`: Architecture and module specs (`ARCHITECTURE.md`, `mail-admin.md`), plus living-doc subfolders (`adr`, `architecture`, `guides`, `management`, `openspec`, `reference`, `specs`, `tests`).
  - `design-system/`: Swiss Modernism 2.0 tokens and guidelines (`design-system/x-blog/MASTER.md`).
  - `gate/`, `.agents/`, `tasks/`: Agent harness verification gate, rules/skills, and task checklists.

---

## 4. Key Constraints & Global Red Lines

1. **Network & Port Isolation**:
   - Never publish host `ports` for `api` or PostgreSQL in `docker-compose.yml`; `web` stays bound to `127.0.0.1:13100:3000`. All browser API traffic routes through Next.js `/api/:path*` rewrites.
2. **Docker / Prisma / Next Standalone Invariants**:
   - Keep `binaryTargets = ["linux-musl-openssl-3.0.x"]` in `apps/api/prisma/schema.prisma` and `apk add --no-cache openssl` in `apps/api/Dockerfile`.
   - Keep `outputFileTracingRoot: path.join(process.cwd(), '../..')` in `apps/web/next.config.ts` and build-time `ENV API_INTERNAL_URL=http://api:4000` in `apps/web/Dockerfile`.
   - Preserve `export const dynamic = 'force-dynamic'` and `fetchJson` fallback behavior on SSR routes so `next build` never fails when the API is offline; call `incrementPostView` only during page render, never in `generateMetadata`.
3. **Seed & Data Safety**:
   - `apps/api/prisma/seed.ts` uses dynamic `import('bcryptjs')` and must not upsert/re-publish sample posts on deploy.
   - Never regenerate or commit `MAIL_ENCRYPTION_KEY`, `JWT_SECRET`, or `.env`; rotating `MAIL_ENCRYPTION_KEY` invalidates stored `QqGroup.encryptedAuthCode` rows.
   - Mail bodies and attachments are fetched on-demand via IMAP and must not be persisted in PostgreSQL; HTML email rendering in `/admin/mail` must remain sandboxed.
4. **Minimal Implementations & Git Safety**:
   - Reuse existing modules/helpers before adding dependencies or abstractions.
   - Never commit directly to `main`; never run `git add .` or `git push --force`; never push without explicit human authorization.

---

## 5. Architectural & Technical Decision Records (ADR / Decision Log)

- **2026-10-24**: [Docker Standalone & Alpine Prisma Target Fixes]
  - **Context**: Production server builds failed due to missing OpenSSL engine target in Prisma, missing `node_modules` in workspace standalone trace, and `localhost:4000` baked into `next.config.ts` rewrites.
  - **Decision**: Pin `linux-musl-openssl-3.0.x` + install `openssl` in API runner; set `outputFileTracingRoot` to workspace root and bake `API_INTERNAL_URL=http://api:4000` at web Docker build time; load `bcryptjs` dynamically in `seed.ts`.
  - **Impact**: Reproducible multi-stage Docker builds on `node:22-alpine`.
- **2026-11-02 ~ 2026-11-09**: [Grouped Multi-Mailbox Admin Viewer (`v1`–`v5.1`)]
  - **Context**: Need to inspect multiple QQ (numeric/letter/Foxmail aliases) and 163 mailboxes inside `/admin/mail` without duplicating passwords or storing mail payloads in Postgres.
  - **Decision**: Store AES-256-GCM encrypted auth codes on `QqGroup`, map 163 accounts to single-mailbox groups via domain inference (no extra DB column), fetch on-demand over IMAP, and deduplicate unified `/api/mail/recent` results per group in `unified-dedupe.ts`.
  - **Impact**: Supports 11+ groups / 29+ mailboxes without persisting mail content or modifying existing QQ data.
- **2026-11-11**: [Project Context & Harness Documentation Alignment]
  - **Context**: Agent harness scaffolding (`AGENTS.md`, `PROJECT_CONTEXT.md`, `SESSION_STATE.md`, `gate/`, `.agents/`) was added to `x-blog`.
  - **Decision**: Populate `PROJECT_CONTEXT.md`, `SESSION_STATE.md`, and `AGENTS.md` from verified repository sources and classify project tier as Standard.
  - **Impact**: Agents start sessions with accurate stack, topology, commands, and operational constraints.
- **2026-11-11**: [Admin Perks Radar Integration (`feature/admin-perks-radar`)]
  - **Context**: Integrate `luobinger/PerkRadar` deal aggregation into `x-blog` without adding a separate container/subdomain or exposing unverified third-party feeds publicly.
  - **Decision**: Implement `PerksModule` inside `apps/api` backed by additive Prisma tables (`PerkRound`, `PerkSourceRun`, `PerkSourceState`, `PerkItem`), differential refresh scheduling (1h fast / 3h slow + `ETag`/`Last-Modified`), and JWT-protected `/admin/perks` UI.
  - **Impact**: Single-console admin experience with PostgreSQL-synced bookmarks/claims and zero changes to public blog routes or Nginx config.
