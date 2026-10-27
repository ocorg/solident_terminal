# Solident — handover for a new chat

**Read this first, then `CLAUDE.md` (technical log) and `docs/SPEC.md` (original spec).** Last updated 27 Oct 2026. Last coding session: 27 Oct 2026 (inventory module). Items marked *(unconfirmed)* were waiting on the owner at the end of that session: ask before assuming they are done.

## 1. What exists

| Thing | Where |
| --- | --- |
| Live site (public FR/AR/EN + `/espace` members + `/admin` staff) | https://solident-web.vercel.app |
| Code | GitHub `ocorg/solident_terminal`, branch `main` (pnpm monorepo: `apps/web`, `packages/db`) |
| Hosting | Vercel project `solident` (Root Directory `apps/web`, functions `fra1`). The Vercel CLI is installed and this folder is linked (`apps/web/.vercel`, git-ignored): `vercel env ls`, `vercel logs`, `vercel ls solident` work |
| Database | Neon project `solident`: branch `production` (live) and `dev` (local + Vercel Preview) |
| Guide for the board (French, with screenshots) | Claude Doc "Solident — Guide du site et de l'espace membres": https://claude.ai/artifact/RP4EHJBDsPuSfQDF1jxxQw (content as of 28 Sep: does not yet cover the PWA, phone notifications or the 29 Sep redesign) |
| Presentation for the board (French, 17 slides) | https://claude.ai/artifact/1X7UJrXgxKCxeqVfCeZiZ6 |
| Exports the owner downloaded | `C:\Users\OCDesign\Downloads\Solident - Guide du site et de l'espace membres.(docx/pdf)`, `Solident - Présentation du nouveau site.pdf` |
| Original logo (1558 px, white background) | `C:\Users\OCDesign\Downloads\Logo Solident.png`. App icons and `public/brand/*` were made from it |

Both artifacts are private until the owner shares them from their Share menu.

## 2. Working with the owner (Oussama)

- Non-coder with a business background, sole developer/admin. Windows + VS Code + PowerShell. Writes in a mix of English and French with typos; answer in **English** in chat unless he writes fully in French. **Documents and presentations for the board are in French.**
- He wants speed and quality over ceremony: small fixes and obvious steps go straight ahead. For a real new feature, give a short plan plus 2–4 targeted questions first (`AskUserQuestion` works well for him).
- **Always ask before `git push` / anything that reaches production**, unless he just said "push". He usually answers "push".
- Explain results in plain words, no jargon. When he must act (Vercel, Google, phone), give numbered click-by-click steps.
- **Secrets:** never print or commit `.env` values. Generate keys straight into `.env.local` without showing them, and tell him which file and lines to copy into Vercel himself.
- Verify before claiming: build passes, live URL checked, screenshots looked at. Say plainly when something could not be tested (e.g. pages behind login on production).
- The board president is a woman ("la présidente"). Use they/them for anyone else whose pronouns are unknown.

## 3. Decisions log (most recent first)

| Date | Decision |
| --- | --- |
| 27 Oct | **No form loses typed data by accident**: on every form (site in 3 languages + back office), leaving with typed data asks "Continuer la saisie / Quitter sans enregistrer"; inventory panels no longer close on a click outside, Escape or "Fermer" when they hold data |
| 27 Oct | Security update of libraries: `pnpm audit` 0 known vulnerabilities (Next 16.4.3, Better Auth 1.7.14, nodemailer 10, zod 4.6.7 + overrides). Re-run `pnpm audit` every few months |
| 27 Oct | **Inventory module** (`/espace/inventaire` + project tab Inventaire) replaces the logistics Google Sheet. Stock = ledger of movements, items held by members only. Rights: members log their own collecte and move their own stock; Logistique managers + space admins run the catalogue, move anyone's stock, undo; project managers own Besoins + bilan. Project pages get tabs Aperçu / Inventaire. Demo data on dev **and** production (wiped from the Catalogue tab before real use). No dark mode (back office has none) |
| 29 Sep | Design pass: keep brand fonts/colours, make them "alive" (brushstroke ring, smile divider, count-ups, scroll reveals, marquee, live countdown); all motion off with reduce-motion and in print. Colour rules in `CLAUDE.md` (gold-700 for small text on light, etc.) |
| 29 Sep | SEO: per-page canonical + hreflang (`alternatesFor`), NGO + Event JSON-LD, home title "soins dentaires gratuits au Maroc" |
| 28 Sep | Installable app (PWA): **one app "Solident" for everyone**, opens on the public site, **no install button**, phone notifications for members (enable per device in Paramètres). The "Envoyer un test" button sends to the current device only |
| 28 Sep | **Law 18-18**: any public appeal for money *or material* (site, social media, even "contact us to help") needs a prior authorization (request ≥30 days before; 1 year max; dedicated bank account; report within 30 days; in-kind distribution declared 10 days before). Solident had **no authorization yet** → public fundraising **closed** on the site via the admin switch (`/admin/campagnes`). Strategy agreed: **request an annual authorization + develop partnership agreements** (not "contact-only") |
| 28 Sep | Revenue sources kept: co-organised caravans (partner handles humanitarian, Solident medical), Solident-branded hygiene kits *offered by companies* (sponsoring, not sales), sponsoring (exists), Moroccan diaspora, monthly donations by standing bank transfer, recognition certificate (not a tax receipt; Solident is not "utilité publique"). Rejected: paid trainings (the "volet scientifique" already does this), paid Solifun events (already active). Principle: every funded activity covers its full cost incl. volunteers' real expenses (reimbursed on receipts, never salaries) + ~20 % margin |
| 28 Sep | Home page is association-first (who we are before donations), at the board's request |
| 27–28 Sep | Official logo everywhere; mobile-friendly back office; admin e-mail for new accounts links to `/admin/utilisateurs` |
| 26–27 Sep | Terminal rebuilt as `/espace` in the same app (one login); Supabase data imported; old Terminal app and Supabase keys deleted |
| 26 Sep | Donor wall = opt-in names only, never amounts; sponsor tier computed from confirmed company donations; progress bar counts confirmed donations only; keep `solident-web.vercel.app`; Claude writes AR/EN (drafts to be reviewed) |
| 26 Sep | Sign-up = request reviewed by an admin (inactive until approved); email + password login, magic link secondary |

## 4. Open items

### Owner to-do *(unconfirmed: ask)*
- [ ] **Law 18-18 authorization request** (target was ~3 Oct for fundraising to open early Nov). When granted: `/admin/campagnes` → tick "Collecte ouverte" + enter the reference
- [ ] Have the legal/tax summary validated by a lawyer or the préfecture (diaspora: check SGG declaration of foreign funds)
- [ ] Vercel: switch Production Branch of `solident` from `monorepo-setup` to `main`; then delete Vercel project `solident-terminal` and the Supabase project. **Until then, every push goes to both `main` and `main:monorepo-setup`**
- [ ] Google Search Console: add the URL-prefix property `https://solident-web.vercel.app`, choose "Balise HTML", send Claude the `content` code → Claude adds `verification: { google: '…' }` to the site metadata and pushes → owner clicks Valider → submit `sitemap.xml`
- [ ] Test phone notifications on his Android after the 29 Sep fix (reload Paramètres, "Envoyer un test")
- [ ] Assign roles (Trésorerie, RH, Médias) in `/admin/utilisateurs`; tell ex-Terminal members to use "Mot de passe oublié"
- [ ] Content: board photos, 22 partner logos, sponsoring dossier PDF, caravan photos + "En chiffres" (photos matter most for the new design), AR/EN proofreading, GPS coordinates of the Al Mussaly caravan
- [ ] Share the guide doc and the presentation with the board
- [ ] Rotate R2 + Pusher keys before a public launch (they were once pasted in chat). He said "forget it" on 27 Sep, so remind him only before a real launch
- [x] Cron: `CRON_SECRET` is set and the cron-job.org digest job runs every 15 min (verified 27 Sep)

### Inventory follow-ups
- [x] Inventory live on production (27 Oct, commit f61dadb) and production demo seeded
- [ ] Show the demo to the board, then "Vider les données de démonstration" (Catalogue tab, admins) before entering real stock
- [ ] Logistique: make sure the people who run the stock hold a non-"Membre" position in "Cellule Organisation & Logistiques" (or are space admins), otherwise they cannot validate bilans or edit the catalogue
- Idea: the public needs list below could reuse each project's Besoins (`inventory_needs`) instead of a new table

### Proposed, waiting for a board decision
- **Public needs list per action** (consumables, instruments, medicines, services with need / pledged / received; professionals click "Je peux fournir"; new admin screen "Dons en nature"). About 2–3 days of work. **Can only go public under the 18-18 authorization**, so it would use the same switch. Open questions: also list documents professionals must provide? Show in-kind donors' names? Who maintains it (Médias or a logistics person)?
- Update the board guide doc with the PWA, notifications and redesign (screenshots are reproducible with the scripts in §6)

### Known gaps / ideas not started
- Small fix pending: on `/fr/solifun` the white-on-sky-blue button (`.mt-8`, contrast 2.8:1) fails WCAG; use navy text or a darker sky. Home meta description is 192 characters (Google shows ~160)
- Real photos everywhere (design placeholders: navy cards with the brushstroke and year)
- Newsletter, annual report pages, custom domain (SPEC phase 5)
- Possible: admin notifications by push for new accounts / donations (push is wired only to `/espace` notifications via `notify()`)

## 5. Calendar / projection

| When | What |
| --- | --- |
| Early Oct 2026 | Authorization request filed (owner) |
| ~1 Nov | Open public fundraising if the authorization is granted |
| Until 15 Nov | Content: photos, logos, dossier, translations |
| 16 Nov – 5 Dec | **Feature freeze** (caravan period): only fixes and content |
| 27–29 Nov | **Caravane Jissr Attadamon** (Douar Oulad Ouchih, Ksar El Kébir; ~400 families; budget 156 563 DH) |
| Within 30 days after a collection ends | Law 18-18 financial report (list of confirmed donations + bank statement) |
| After the caravan | Create its action page (photos, "En chiffres"), link the campaign → public report |
| 2027 | Custom domain, newsletter, annual report pages, Ramadan diaspora campaign (needs authorization) |

## 6. How Claude works on this repo (runbook)

- **Local dev:** start with PowerShell `pnpm dev:web` as a *background* task (Git Bash background dies). Never run `pnpm build:web` while dev runs. Turbopack crash → stop, `rm -rf apps/web/.next`, restart.
- **Session restarts kill background tasks** (dev server, long audits). Keep long checks in the foreground with `timeout`, or re-start them.
- **Temporary test account** (dev DB only): sign up `guide.admin@example.com` via `POST /api/auth/sign-up/email` (header `Origin: http://localhost:3001`), then `pnpm db:user approve guide.admin@example.com admin`. **Delete it afterwards** with a small tsx script in `packages/db/scripts/` (`prisma.user.deleteMany`), then remove the script. Never create test accounts on production.
- **Browser automation:** `playwright-core` + Edge at `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. Push subscriptions need `launchPersistentContext` (incognito contexts refuse push). Full-page screenshots hide `data-reveal` content (scroll-driven), so scroll first or take viewport shots.
- **Audits:** `tools/qa/` (see its README): `axe-audit.mjs` (accessibility WCAG 2.2 AA + SEO checks, public or back office) and `overflow.mjs` (no sideways scroll at 390 px). Lighthouse (`npx lighthouse … --chrome-flags=--headless=new`, `CHROME_PATH` = Edge). **Lighthouse performance varies ±10 points between runs**: compare several runs, and for a regression compare old vs new on the same machine (a `git worktree` of the old commit + `next start` on another port; delete the worktree's `.env` copies afterwards).
- **Shell gotchas (Git Bash on Windows):** files are CRLF, so string replacements anchored on `\n` fail (use the Edit tool or detect `\r\n`). Args starting with `/` get converted to Windows paths (`MSYS_NO_PATHCONV=1`). Nested quotes in `node -e` break easily: prefer writing a file. Long `node_modules` paths: delete with robocopy `/MIR` from an empty folder.
- **Migrations:** `prisma migrate dev` refuses non-interactive shells: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql`, then `prisma migrate deploy` (dev). Production is migrated by the Vercel build.
- **Deploy check:** after a push, poll the live URL for a string or file that only the new version has; `vercel ls solident` shows deployment status. Vercel skips commits that do not touch `apps/web` (docs-only pushes do not deploy).
- **Prod data checks:** read-only scripts with `DB_ENV_FILE=.env.production` (counts only, no personal data in chat).
