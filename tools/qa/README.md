# Quality checks (run by hand)

Standalone scripts, not part of the pnpm workspace or the Vercel build. They drive Microsoft Edge (already on Windows) with `playwright-core`; set `BROWSER_PATH` to use another Chromium browser.

```
cd tools/qa
npm install                         # once: axe-core + playwright-core (node_modules is git-ignored)

node axe-audit.mjs https://solident-web.vercel.app public    # accessibility + SEO, live public pages
node overflow.mjs https://solident-web.vercel.app public      # nothing scrolls sideways at 390 px
npx lighthouse https://solident-web.vercel.app/fr --only-categories=performance,accessibility,best-practices,seo --chrome-flags=--headless=new
```

For Lighthouse, set `CHROME_PATH` to Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`). Its performance score varies by about ±10 points between runs: compare several runs, and compare old and new versions on the same machine.

## Back-office pages (`back` group)

These need a logged-in staff account. **On the local dev database only** (never production):

1. Start the site: `pnpm dev:web` (port 3001).
2. Create the temporary account:
   - `POST http://localhost:3001/api/auth/sign-up/email` with header `Origin: http://localhost:3001` and body `{"name":"Admin Demo","email":"guide.admin@example.com","password":"Guide-demo-2026"}`;
   - then `pnpm db:user approve guide.admin@example.com admin` (from the repo root).
3. Run `node axe-audit.mjs http://localhost:3001 back` or `node overflow.mjs http://localhost:3001 back`.
4. **Delete the account afterwards**: a one-off tsx script in `packages/db/scripts/` running `prisma.user.deleteMany({ where: { email: 'guide.admin@example.com' } })`, then delete that script.

The password is a throwaway for this dev-only account; override it with `QA_PASSWORD` if you prefer.
