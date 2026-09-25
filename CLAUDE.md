# Solident monorepo — context for Claude Code

This repo holds two Next.js apps for **Association Solident** (Moroccan dental NGO, see `docs/SPEC.md` §1):

- `apps/terminal` — Solident Terminal, the existing internal mini-ERP. **Still on Supabase** until Phase 4. Has its own `CLAUDE.md` / `AGENTS.md`; read them before touching it.
- `apps/web` — the new public trilingual website (FR / AR / EN) + `/admin`. Being built now.
- `packages/db` — shared Prisma schema + client (`@solident/db`) on **Neon Postgres**. Not created yet.

Full spec: **`docs/SPEC.md`** (architecture, site map, data model, flows, admin roles, design system, roadmap). Read it before any feature work.

## Owner and working style

- Owner: Oussama, sole developer/admin. Non-coder ("vibecoder") with a business background, works on **Windows + VS Code + PowerShell**.
- Before writing code for a new feature: give a short summary of your understanding (architecture + data mapping), a flow outline (User action → client → server action → DB → UI feedback), and at least 3 targeted questions. Small fixes and setup commands can go straight ahead.
- Explain what each command does in one line. Never print or commit secrets; values from `.env` files never go in chat or git.

## Stack (decided)

Next.js App Router + TypeScript · pnpm 10 workspaces · Neon Postgres + **Prisma** (`@prisma/adapter-neon`) · **Better Auth** 1.7 (Prisma adapter, magic-link plugin via Nodemailer + the same Gmail SMTP account Terminal uses; chosen over Auth.js, which is in maintenance mode) · Pusher Channels · Cloudflare R2 · next-intl · Tailwind · Vercel Hobby (`*.vercel.app` for now) · cron-job.org for scheduled jobs.

## Conventions (must follow)

- Server actions / route handlers return `{ status: 'success', data }` or throw an `Error`; never return `null`.
- Every client call: loading state (disabled button + spinner) and success/error toast.
- Validate every input with Zod on the server before writing. Multi-step writes use `prisma.$transaction`.
- No RLS on Neon: every admin action checks the role server-side (`requireRole`).
- DB content columns are suffixed `_fr`, `_ar`, `_en`; UI strings live in next-intl JSON messages. Arabic uses `dir="rtl"`; use logical CSS properties.
- Design: navy `#1E5470` / gold `#F4B223` / cream `#FBF8F2`, Poppins + Montserrat, IBM Plex Sans Arabic; 8–12 px radii, soft shadows, hover/active micro-interactions (spec §8).

## Commands (run from repo root)

```
pnpm install
pnpm dev:terminal   # http://localhost:3000
pnpm dev:web        # http://localhost:3001
pnpm build:terminal
pnpm build:web
pnpm db:migrate     # create + apply a migration on the dev branch (after editing schema.prisma)
pnpm db:status      # is the DB in sync with the migrations?
pnpm db:seed        # (re)load seed data, safe to re-run
pnpm db:studio      # browse data in the browser
pnpm db:generate    # rebuild the Prisma client
```

## Progress — Phase 0 (foundations)

Work happens on branch **`monorepo-setup`**. Restore point: tag **`pre-monorepo`** (old single-app layout).

- [x] Step 1 — safety tag + branch, pnpm 10.34.5 (pnpm 11 failed on Windows; stay on 10), Node 22.22.3
- [x] Step 2 — Terminal moved to `apps/terminal` (its `.env.local` and `.vercel` moved with it, both git-ignored)
- [x] Step 3 — root `package.json` + `pnpm-workspace.yaml`; Terminal runs from the monorepo
- [x] Step 4 — `apps/web` scaffolded (Next 16.3.6, port 3001). Terminal is on Next 16.2.2; align in Phase 4
- [x] Step 5 — Neon project `solident` (AWS Frankfurt, database `neondb`), branches `main` (prod, still empty) + `dev`. `packages/db` = `@solident/db` on **Prisma 7.10.0, pinned exactly** (npm's `latest` tag points at an 8.0 RC; don't upgrade by accident). `prisma.config.ts` gives `DIRECT_URL` to the CLI; `src/index.ts` exports `prisma` via `PrismaNeon` on pooled `DATABASE_URL`; client generated to `src/generated/prisma` (git-ignored, rebuilt on `postinstall`). Migration `init` applied on `dev`; seed (`prisma/seed.ts`, re-runnable) loaded 6 programmes, 22 partners, 21 actions (14 caravans), Jissr Attadamon event + campaign, 4 tiers, 11 board members, impact stats, admin user from `SEED_ADMIN_EMAIL`. Deviations from SPEC §5: `action_partners` join table (not `partner_ids[]`), `campaigns.raised_dh/donors_count` cache, `events.programme_id/created_by`, `team_members.phone/is_public_contact`, unique `(event_id, phone)` on registrations. AR/EN seed text and most map coordinates are drafts to review
- [x] Step 6 — Better Auth in `apps/web`, **email + password** (magic link kept as a secondary option). `src/lib/auth.ts`: sign-up creates an inactive `member` (hook forces role/isActive; `input:false` rejects them from the client), admins emailed on every new account, pending users cannot open a session (`FAILED_TO_CREATE_SESSION`), existing-email sign-up answers like success and emails the owner, reset link 1 h (also sets a first password for accounts that never had one), sessions 30 days, rate limits in Postgres (`rate_limits`; sign-in 5/min). Browser forms call `authClient` (`src/lib/auth-client.ts`, French error messages) so limits apply. Pages: `/connexion`, `/inscription` (tabbed `components/auth-card.tsx`), `/mot-de-passe-oublie`, `/mot-de-passe/nouveau`, `/admin` (staff roles), `/acces-refuse`. Guards in `src/lib/guards.ts` (`requireRole` for actions, `requireRolePage` for pages). Approve members with `pnpm db:user approve <email> [role]` (Prisma Studio fails to save `users` rows). Env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GMAIL_USER`, `GMAIL_PASS`. Note: `prisma migrate dev` refuses to run in Claude's non-interactive shell; write SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into a new migration folder, then `prisma migrate deploy`. Server actions: return expected user errors as data, not thrown (Next hides thrown messages in production)
- [x] Step 7 — Cloudflare R2: buckets `solident-media` (public, r2.dev URL) + `solident-private` (proofs), location WEUR, CORS allows `http://localhost:3001` (GET, PUT, content-type) — add the Vercel origin in Step 10. Token = Object Read & Write on both buckets. `apps/web/src/lib/r2.ts`: presigned PUT signs content type + exact size (oversize → 403), private files via 5-min signed GET. Admin test page `/admin/outils/upload`. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL`
- [x] Step 8 — Pusher app `solident` (cluster `eu`). `src/lib/realtime.ts` = channel names (`campaign-{id}`, `event-{id}`) + typed payloads (`total-updated`, `places-updated`); `src/lib/pusher.ts` `broadcast()` (server, call after the transaction commits); `src/lib/use-realtime.ts` `useRealtime()` hook (browser). Test page `/admin/outils/temps-reel`. Env: `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
- [x] Step 9 — next-intl 4.14.7. `src/i18n/routing.ts` (fr/ar/en, default fr, prefix always, browser language detection on `/`), `request.ts` (ar/en messages deep-merged over fr, so missing keys fall back to French), `navigation.ts` (locale-aware `Link`). `src/proxy.ts` (Next 16 name for middleware): back-office paths skipped **in code** — a long negative-lookahead matcher silently failed in Next 16. Route groups: `app/(site)/[locale]/…` (public, `<html lang dir>`, header with FR / ع / EN switcher, footer) and `app/(backoffice)/…` (French only: admin, connexion, inscription, password pages). Catch-all `[locale]/[...slug]` renders "coming soon" for every §4 section until its real page exists. UI strings in `apps/web/messages/{fr,ar,en}.json` (AR/EN are drafts to review). DB text via `localized(row, "title", locale)` in `src/lib/localized.ts`. Design tokens + `btn`/`btn-primary`/`btn-cta`/`btn-ghost`/`card`/`card-hover`/`divider-dot`/`flip-rtl` utilities in `globals.css`; IBM Plex Sans Arabic not preloaded (only downloads on /ar). Home page reads impact stats + next event + active campaign (revalidate 5 min). Dev server: start it from PowerShell — Git Bash background runs die with exit 127
- [ ] Step 10 — Vercel: new project for `apps/web` (Root Directory `apps/web`, function region `fra1`, env vars). **Before merging `monorepo-setup` into `main`**, change the existing Terminal Vercel project's Root Directory to `apps/terminal` and set its install command for pnpm, or the live Terminal breaks.

Next phases after Phase 0: see roadmap in `docs/SPEC.md` §9 (fundraising launch by 25 Oct 2026, caravan 27–29 Nov 2026, Terminal migration Dec 2026–Jan 2027).
