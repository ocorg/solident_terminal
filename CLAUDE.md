# Solident monorepo — context for Claude Code

This repo holds two Next.js apps for **Association Solident** (Moroccan dental NGO, see `docs/SPEC.md` §1):

- `apps/terminal` — Solident Terminal, the existing internal mini-ERP. **Still on Supabase** until Phase 4. Has its own `CLAUDE.md` / `AGENTS.md`; read them before touching it.
- `apps/web` — the new public trilingual website (FR / AR / EN) + `/admin`. Being built now.
- `packages/db` — shared Prisma schema + client (`@solident/db`) on **Neon Postgres** (branches `production` + `dev`).

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

## Progress — Phase 0 (foundations) ✅ done 26 Sep 2026

Work happens on branch **`monorepo-setup`**. Restore point: tag **`pre-monorepo`** (old single-app layout).

- [x] Step 1 — safety tag + branch, pnpm 10.34.5 (pnpm 11 failed on Windows; stay on 10), Node 22.22.3
- [x] Step 2 — Terminal moved to `apps/terminal` (its `.env.local` and `.vercel` moved with it, both git-ignored)
- [x] Step 3 — root `package.json` + `pnpm-workspace.yaml`; Terminal runs from the monorepo
- [x] Step 4 — `apps/web` scaffolded (Next 16.3.6, port 3001). Terminal is on Next 16.2.2; align in Phase 4
- [x] Step 5 — Neon project `solident` (AWS Frankfurt, database `neondb`), branches `production` (default; called main in older notes) + `dev`. `packages/db` = `@solident/db` on **Prisma 7.10.0, pinned exactly** (npm's `latest` tag points at an 8.0 RC; don't upgrade by accident). `prisma.config.ts` gives `DIRECT_URL` to the CLI; `src/index.ts` exports `prisma` via `PrismaNeon` on pooled `DATABASE_URL`; client generated to `src/generated/prisma` (git-ignored, rebuilt on `postinstall`). Migration `init` applied on `dev`; seed (`prisma/seed.ts`, re-runnable) loaded 6 programmes, 22 partners, 21 actions (14 caravans), Jissr Attadamon event + campaign, 4 tiers, 11 board members, impact stats, admin user from `SEED_ADMIN_EMAIL`. Deviations from SPEC §5: `action_partners` join table (not `partner_ids[]`), `campaigns.raised_dh/donors_count` cache, `events.programme_id/created_by`, `team_members.phone/is_public_contact`, unique `(event_id, phone)` on registrations. AR/EN seed text and most map coordinates are drafts to review
- [x] Step 6 — Better Auth in `apps/web`, **email + password** (magic link kept as a secondary option). `src/lib/auth.ts`: sign-up creates an inactive `member` (hook forces role/isActive; `input:false` rejects them from the client), admins emailed on every new account, pending users cannot open a session (`FAILED_TO_CREATE_SESSION`), existing-email sign-up answers like success and emails the owner, reset link 1 h (also sets a first password for accounts that never had one), sessions 30 days, rate limits in Postgres (`rate_limits`; sign-in 5/min). Browser forms call `authClient` (`src/lib/auth-client.ts`, French error messages) so limits apply. Pages: `/connexion`, `/inscription` (tabbed `components/auth-card.tsx`), `/mot-de-passe-oublie`, `/mot-de-passe/nouveau`, `/admin` (staff roles), `/acces-refuse`. Guards in `src/lib/guards.ts` (`requireRole` for actions, `requireRolePage` for pages). Approve members with `pnpm db:user approve <email> [role]` (Prisma Studio fails to save `users` rows). Env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GMAIL_USER`, `GMAIL_PASS`. Note: `prisma migrate dev` refuses to run in Claude's non-interactive shell; write SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into a new migration folder, then `prisma migrate deploy`. Server actions: return expected user errors as data, not thrown (Next hides thrown messages in production)
- [x] Step 7 — Cloudflare R2: buckets `solident-media` (public, r2.dev URL) + `solident-private` (proofs), location WEUR, CORS allows `http://localhost:3001` (GET, PUT, content-type) — add the Vercel origin in Step 10. Token = Object Read & Write on both buckets. `apps/web/src/lib/r2.ts`: presigned PUT signs content type + exact size (oversize → 403), private files via 5-min signed GET. Admin test page `/admin/outils/upload`. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL`
- [x] Step 8 — Pusher app `solident` (cluster `eu`). `src/lib/realtime.ts` = channel names (`campaign-{id}`, `event-{id}`) + typed payloads (`total-updated`, `places-updated`); `src/lib/pusher.ts` `broadcast()` (server, call after the transaction commits); `src/lib/use-realtime.ts` `useRealtime()` hook (browser). Test page `/admin/outils/temps-reel`. Env: `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
- [x] Step 9 — next-intl 4.14.7. `src/i18n/routing.ts` (fr/ar/en, default fr, prefix always, browser language detection on `/`), `request.ts` (ar/en messages deep-merged over fr, so missing keys fall back to French), `navigation.ts` (locale-aware `Link`). `src/proxy.ts` (Next 16 name for middleware): back-office paths skipped **in code** — a long negative-lookahead matcher silently failed in Next 16. Route groups: `app/(site)/[locale]/…` (public, `<html lang dir>`, header with FR / ع / EN switcher, footer) and `app/(backoffice)/…` (French only: admin, connexion, inscription, password pages). Catch-all `[locale]/[...slug]` renders "coming soon" for every §4 section until its real page exists. UI strings in `apps/web/messages/{fr,ar,en}.json` (AR/EN are drafts to review). DB text via `localized(row, "title", locale)` in `src/lib/localized.ts`. Design tokens + `btn`/`btn-primary`/`btn-cta`/`btn-ghost`/`card`/`card-hover`/`divider-dot`/`flip-rtl` utilities in `globals.css`; IBM Plex Sans Arabic not preloaded (only downloads on /ar). Home page reads impact stats + next event + active campaign (revalidate 5 min). Dev server: start it from PowerShell — Git Bash background runs die with exit 127
- [x] Step 10 — **Website live at https://solident-web.vercel.app** (Vercel project `solident`: Root Directory `apps/web`, Production Branch = `monorepo-setup` until merge, functions `fra1` via `apps/web/vercel.json`, whose build runs `prisma migrate deploy` on the environment's own DB). Env: Production = Neon `production` branch (endpoint `ep-little-violet-b2to2onm`) + `BETTER_AUTH_URL`; Preview = Neon `dev`; shared = Gmail/R2/Pusher/new `BETTER_AUTH_SECRET`. Production DB migrated + seeded from this machine with `DB_ENV_FILE=.env.production` (`packages/db/.env.production`, git-ignored). Vercel skips deployments of commits that do not touch the root directory (use Deployments → Create Deployment). R2 CORS allows the live origin; admin password set on production (26 Sep). Lesson: Vercel Production env first held the `dev` URLs by mistake; to check which DB a deployment uses, look at the host in the URL (`ep-little-violet` = production, `ep-young-band` = dev) or at which DB receives `rate_limits` rows after a few wrong logins. **Open:** rotate R2 + Pusher keys before public launch (they were shared in chat). **Live Terminal = separate Vercel project `solident-terminal`, untouched.** Before merging `monorepo-setup` into `main`, set that project's Root Directory to `apps/terminal` + pnpm, and switch `solident` Production Branch back to `main`, or the live Terminal breaks.

## Progress — Phase 1 (fundraising launch, due 25 Oct 2026)

Decisions (26 Sep): donor wall = opt-in names, never amounts; sponsor wall = companies, tier computed from the partner's confirmed total vs `sponsor_tiers.min_dh` (company gifts are donations with `partner_id`); progress bar counts confirmed donations only; placeholders until real photos/logos/dossier; Claude writes AR/EN; keep `solident-web.vercel.app`.

- [x] Donation flow: `src/lib/donations.ts` (confirm/reject/manual in one transaction with a campaign row lock + audit log; Pusher + revalidate after commit, both non-fatal), `/[locale]/soutenir/don` (live bar, RIB + copy + QR, declaration form with private receipt upload, donor + sponsor walls), live bar on home, donor thank-you + staff alert emails. Public actions are rate-limited in Postgres (`src/lib/rate-limit.ts`, `app:` keys) and have a honeypot. Server actions return `ActionResult` (`src/lib/action.ts`)
- [x] Admin: role-filtered nav with badges, dashboard, `/admin/dons`, `/admin/campagnes` (FR/AR/EN tabs), `/admin/utilisateurs` (approve/role/deactivate + approval email; replaces `pnpm db:user`), `/admin/messages`
- [x] Pages: `/soutenir/sponsoring` (tiers from DB, inquiry form, public contacts, sponsor wall; dossier link = `org.dossierUrl` in `src/lib/org.ts`, null until the PDF is uploaded), `/contact`, `/qui-sommes-nous` (story, charter, governance, board with initials placeholders). Pages with a real route are listed in `builtSections` (`components/site/nav-items.ts`) so the "coming soon" catch-all skips them
- [x] Media screens (admin + media roles): `/admin/equipe` (members + photos), `/admin/partenaires` (partners + logos), `/admin/documents` (sponsoring PDF → `site_settings.dossier_url`). Images are shrunk to WebP in the browser (`components/admin/upload.ts`, also strips EXIF/GPS), keys validated per folder server-side (`src/lib/media-actions.ts`), replaced files deleted from R2
- [x] Home page: hero, impact counters, programmes teaser, next event + live bar, mission/vision/values, partner strip (logos, or names until uploaded)
- [ ] Rotate R2 + Pusher keys before public launch

Dev gotchas: Turbopack on Windows occasionally crashes the dev server (exit 3765269347) and can leave a corrupt cache (every page 404) — stop it, `rm -rf apps/web/.next`, restart. Never run `pnpm build:web` while `pnpm dev:web` is running (the dev server then serves stale prerendered pages as 404; fix = stop it, delete `apps/web/.next`, restart). After a Prisma schema change, restart the dev server (the client is cached across hot reloads).

## Progress — Phase 2 (events and content, 26 Oct – 15 Nov 2026)

Decision (26 Sep): registration form = name + phone (required) + email, city, profile, note; no per-activity fields yet (the note covers it).

- [x] Events + registrations: `src/lib/registrations.ts` (capacity + duplicate phone in one transaction with an event row lock; "closed" wins over "full"; cancel frees a place; Pusher `places-updated`), `src/lib/phone.ts` (Moroccan numbers → E.164 so duplicates match), `/[locale]/evenements` (upcoming/past, type filter), `/[locale]/evenements/[slug]` (live places + form, confirmation email), `/[locale]/solifun` hub. Admin: `/admin/evenements` (admin+media edit, hr read; cover image; datetime inputs in Casablanca time via `src/lib/tz.ts`, Ramadan-safe), `/admin/inscriptions` (admin+hr; status; CSV export for Excel with BOM, ";" and formula-injection guard). next-intl `timeZone: Africa/Casablanca`
- [x] `/soutenir/benevolat` (vol-* fields, HR + admins emailed) + `/admin/benevoles` (admin+hr, statuses, WhatsApp links); `/programmes` + `/programmes/[slug]` (actions + upcoming events); `/actions` (totals, Leaflet/OpenStreetMap map of caravans with coordinates, timeline by year, programme filter) + `/actions/[slug]` (gallery from `media`); `/partenaires` (grouped by type, actions together). Every §4 section now has a real page
- [x] `/admin/contenu` (admin+media): programmes (3 languages, cover, order, visible) and actions (3 languages, dates, place, Google-Maps coordinates with swap/range checks, beneficiaries, partners, publish, cover, multi-photo gallery in `media`, 1600 px WebP). Covers for actions/programmes/events use the shared `setImage`

## Progress — Phase 3 (caravan period 16 Nov – 5 Dec: feature freeze; code ready early)

- [x] Caravan coordinates: 12 of 14 caravans on the map (Al Mussaly and Bni Harchen still missing); `/admin/contenu` accepts Google Maps decimals and Google Earth DMS
- [x] Post-caravan report = action page: `actions.figures` JSON ("En chiffres", FR required, AR/EN fall back) edited in `/admin/contenu`; a campaign linked via `campaigns.action_id` (select in `/admin/campagnes`) adds final funding, sponsor wall, donor names and a thank-you block. After Jissr Attadamon: create its action, fill figures + photos, link the campaign
- [x] Launch essentials: `app/sitemap.ts` (all public pages × 3 languages with hreflang, hourly), `app/robots.ts` (admin/auth disallowed; previews fully noindex), `[locale]/opengraph-image.tsx` (brand share image, Latin text only), `[locale]/error.tsx`, security headers in `next.config.ts`, `metadataBase` + openGraph defaults

Next phases after Phase 0: see roadmap in `docs/SPEC.md` §9 (fundraising launch by 25 Oct 2026, caravan 27–29 Nov 2026, Terminal migration Dec 2026–Jan 2027).
