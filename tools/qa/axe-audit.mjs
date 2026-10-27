// Accessibility audit (axe-core, WCAG 2.2 AA + best practices) of every page, plus basic SEO checks on public pages.
// Usage (from tools/qa, after `npm install`):
//   node axe-audit.mjs https://solident-web.vercel.app public
//   node axe-audit.mjs http://localhost:3001 back        (needs the temporary dev account, see README)
//   DESKTOP_ONLY=1 node axe-audit.mjs <base> <group>     (skip the phone pass, faster)
// Note: elements caught mid-animation (scroll reveals) can show as false contrast failures.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const EDGE = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const [base, group] = process.argv.slice(2)
if (!base || !['public', 'back'].includes(group)) {
  console.error('Usage: node axe-audit.mjs <base-url> public|back')
  process.exit(1)
}

const PUBLIC = ['/fr', '/fr/qui-sommes-nous', '/fr/programmes', '/fr/actions', '/fr/evenements', '/fr/solifun', '/fr/partenaires', '/fr/contact', '/fr/soutenir/don', '/fr/soutenir/sponsoring', '/fr/soutenir/benevolat', '/ar', '/en', '/ar/actions']
const BACK = ['/connexion', '/inscription', '/mot-de-passe-oublie', '/espace', '/espace/taches', '/espace/projets', '/espace/cellules', '/espace/evenements', '/espace/propositions', '/espace/membres', '/espace/notifications', '/espace/parametres', '/admin', '/admin/dons', '/admin/campagnes', '/admin/evenements', '/admin/inscriptions', '/admin/benevoles', '/admin/contenu', '/admin/equipe', '/admin/partenaires', '/admin/documents', '/admin/messages', '/admin/utilisateurs']
const TEST_ACCOUNT = { email: 'guide.admin@example.com', password: process.env.QA_PASSWORD || 'Guide-demo-2026' }

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const agg = new Map()
const seo = []
const viewports = process.env.DESKTOP_ONLY ? [{ width: 1280, height: 860 }] : [{ width: 1280, height: 860 }, { width: 390, height: 844, isMobile: true }]

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile })
  if (group === 'back') await ctx.request.post(base + '/api/auth/sign-in/email', { headers: { Origin: base }, data: TEST_ACCOUNT })
  const page = await ctx.newPage()
  for (const path of group === 'back' ? BACK : PUBLIC) {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(400)
    await page.addScriptTag({ content: axeSrc })
    const res = await page.evaluate(async () =>
      (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        n: v.nodes.length,
        ex: v.nodes.slice(0, 2).map((x) => x.target.join(' ') + (x.any[0]?.message ? ' — ' + x.any[0].message.slice(0, 110) : '')),
      })),
    )
    for (const v of res) {
      const a = agg.get(v.id) ?? { impact: v.impact, help: v.help, pages: new Set(), n: 0, ex: [] }
      a.pages.add(path + (vp.isMobile ? ' (mobile)' : ''))
      a.n += v.n
      if (a.ex.length < 3) a.ex.push(...v.ex.slice(0, 3 - a.ex.length).map((e) => path + ': ' + e))
      agg.set(v.id, a)
    }
    if (group === 'public' && !vp.isMobile) {
      seo.push(
        await page.evaluate((p) => {
          const q = (s) => document.querySelector(s)
          return {
            p,
            title: document.title,
            desc: q('meta[name=description]')?.content?.length ?? 0,
            h1: document.querySelectorAll('h1').length,
            canonical: q('link[rel=canonical]')?.href ?? '-',
            hreflang: document.querySelectorAll('link[rel=alternate][hreflang]').length,
            jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
            imgNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
          }
        }, path),
      )
    }
  }
  await ctx.close()
}
await browser.close()

const order = { critical: 0, serious: 1, moderate: 2, minor: 3 }
if (!agg.size) console.log('No accessibility violations found.')
for (const [id, a] of [...agg].sort((x, y) => order[x[1].impact] - order[y[1].impact]))
  console.log(`[${a.impact}] ${id} — ${a.help} — ${a.n} nodes on ${a.pages.size} page-views\n   ${a.ex.join('\n   ')}`)
if (seo.length) {
  console.log('\nSEO (expect: 1 h1, description 100–160 chars, canonical to itself, 4 hreflang incl. x-default, 0 images without alt)')
  for (const s of seo) console.log(`${s.p.padEnd(26)} desc:${s.desc} h1:${s.h1} hreflang:${s.hreflang} jsonld:${s.jsonld} noalt:${s.imgNoAlt} canonical:${s.canonical} | ${s.title}`)
}
