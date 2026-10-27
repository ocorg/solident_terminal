// Phone layout check: every page at 390 px wide must not scroll sideways. Lists the elements sticking out.
// Usage: node overflow.mjs <base-url> [public|back]   (back needs the temporary dev account, see README)
import { chromium } from 'playwright-core'

const EDGE = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const [base, group = 'public'] = process.argv.slice(2)
const PUBLIC = ['/fr', '/fr/qui-sommes-nous', '/fr/programmes', '/fr/actions', '/fr/evenements', '/fr/solifun', '/fr/partenaires', '/fr/contact', '/fr/soutenir/don', '/fr/soutenir/sponsoring', '/fr/soutenir/benevolat', '/ar', '/ar/actions', '/en']
const BACK = ['/espace', '/espace/taches', '/espace/projets', '/espace/cellules', '/espace/evenements', '/espace/propositions', '/espace/membres', '/espace/notifications', '/espace/parametres', '/admin', '/admin/dons', '/admin/campagnes', '/admin/evenements', '/admin/inscriptions', '/admin/benevoles', '/admin/contenu', '/admin/equipe', '/admin/partenaires', '/admin/documents', '/admin/messages', '/admin/utilisateurs']

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
if (group === 'back') await ctx.request.post(base + '/api/auth/sign-in/email', { headers: { Origin: base }, data: { email: 'guide.admin@example.com', password: process.env.QA_PASSWORD || 'Guide-demo-2026' } })
const page = await ctx.newPage()
let bad = 0
for (const path of group === 'back' ? BACK : PUBLIC) {
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    const over = document.documentElement.scrollWidth - w
    // Elements inside their own scroll box (tables, maps, marquees) are allowed to be wider
    const inScroller = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) return true
      }
      return false
    }
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > w + 1 && !inScroller(el))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join('.')} (+${Math.round(el.getBoundingClientRect().right - w)}px)`)
    return { over, offenders }
  })
  if (r.over > 1) bad++
  console.log(`${r.over > 1 ? 'OVERFLOW' : 'ok'.padEnd(8)} ${path}${r.over > 1 ? `  +${r.over}px\n   ${r.offenders.join('\n   ')}` : ''}`)
}
await browser.close()
console.log(bad ? `\n${bad} page(s) scroll sideways on a phone.` : '\nAll pages fit a 390 px phone screen.')
