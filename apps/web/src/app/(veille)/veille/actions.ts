'use server'

import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { sendMail } from '@/lib/mail'
import { allow } from '@/lib/rate-limit'

const schema = z.object({
  name: z.string().trim().max(80).optional().default(''),
  contact: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().max(1000).optional().default(''),
  lang: z.enum(['fr', 'ar', 'en']).default('fr'),
  website: z.string().max(200).optional().default(''), // honeypot: humans leave it empty
})

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Global cap (all visitors together), so the button can never flood the owner's inbox. */
async function globalAllow(max: number, windowSeconds: number) {
  const key = 'app:veille-ping:all'
  const now = Date.now()
  const row = await prisma.rateLimit.findUnique({ where: { key } })
  if (!row || now - Number(row.lastRequest) > windowSeconds * 1000) {
    await prisma.rateLimit.upsert({ where: { key }, create: { key, count: 1, lastRequest: BigInt(now) }, update: { count: 1, lastRequest: BigInt(now) } })
    return true
  }
  if (row.count >= max) return false
  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } })
  return true
}

/** "Ping project": e-mails the owner that someone wants to use the sleeping platform. */
export async function pingProject(input: z.input<typeof schema>) {
  return run(async () => {
    const d = schema.parse(input)
    if (d.website) return ok({ sent: true }) // bot: pretend it worked
    if (!(await allow('veille-ping', 3, 3600))) return fail('tooMany')
    if (!(await globalAllow(20, 86_400))) return fail('tooMany')

    const to = process.env.HIBERNATE_NOTIFY_EMAIL || process.env.GMAIL_USER
    if (!to) return fail('error')
    const when = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Casablanca' })
    const rows = [
      ['Nom', d.name || '(non renseigné)'],
      ['Contact', d.contact || '(non renseigné)'],
      ['Message', d.message || '(aucun)'],
      ['Langue de la page', d.lang.toUpperCase()],
      ['Date', when],
    ]
    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(18,58,79,.08);line-height:1.6"><p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a6100">Projet en veille</p><h1 style="margin:0 0 16px;font-size:20px">Quelqu’un demande l’accès à Solident</h1><table style="width:100%;border-collapse:collapse;font-size:14px">${rows
      .map(([k, v]) => `<tr><td style="padding:8px 0;color:#4A5A66;vertical-align:top;width:130px">${k}</td><td style="padding:8px 0;white-space:pre-wrap">${esc(v)}</td></tr>`)
      .join('')}</table><p style="margin:20px 0 0;font-size:13px;color:#4A5A66">Pour rouvrir la plateforme : Vercel → projet solident → Settings → Environment Variables → supprimer HIBERNATE → redéployer.</p></div></body></html>`
    const text = rows.map(([k, v]) => `${k} : ${v}`).join('\n')
    await sendMail(to, 'Solident : demande d’accès (ping)', html, text, d.contact.includes('@') ? d.contact : undefined)
    return ok({ sent: true })
  }, 'error')
}
