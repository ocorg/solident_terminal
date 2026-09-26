'use server'

import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from './action'
import { sendMail } from './mail'
import { allow } from './rate-limit'
import { siteUrl } from './site-url'

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

const schema = z.object({
  kind: z.enum(['contact', 'sponsor']),
  fullName: opt(80),
  organisation: opt(120),
  email: z.email().trim().toLowerCase(),
  phone: opt(30),
  message: opt(2000),
  tierId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
  website: z.string().max(0).optional(), // honeypot
})

export type InquiryInput = z.input<typeof schema>
// Error codes are translated on the client (messages Inquiry.err*).
export type InquiryError = 'errGeneric' | 'errTooMany' | 'errFields'

/** Contact form and sponsor inquiry (spec §5 inquiries). Saved first, then admins are emailed. */
export async function sendInquiry(input: InquiryInput) {
  return run(async () => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('errFields')
    const d = parsed.data
    if (d.kind === 'contact' && (!d.fullName || !d.message)) return fail('errFields')
    if (d.kind === 'sponsor' && !d.organisation) return fail('errFields')
    if (!(await allow(`inquiry-${d.kind}`, 5, 600))) return fail('errTooMany')

    const { website: _hp, ...data } = d
    const inquiry = await prisma.inquiry.create({ data, include: { tier: { select: { name: true } } } })

    const who = [d.fullName, d.organisation].filter(Boolean).join(' · ') || d.email
    const subject = d.kind === 'sponsor' ? `Demande de sponsoring : ${who}` : `Nouveau message : ${who}`
    const lines = [
      d.kind === 'sponsor' ? 'Type : sponsoring' : 'Type : contact',
      d.organisation && `Organisation : ${d.organisation}`,
      d.fullName && `Nom : ${d.fullName}`,
      `E-mail : ${d.email}`,
      d.phone && `Téléphone : ${d.phone}`,
      inquiry.tier && `Formule : ${inquiry.tier.name}`,
      d.message && `\n${d.message}`,
    ].filter(Boolean) as string[]
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(18,58,79,.08);line-height:1.6"><p style="margin:0 0 12px;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:18px;color:#1E5470">${esc(subject)}</p>${lines.map((l) => `<div style="white-space:pre-wrap">${esc(l)}</div>`).join('')}<p style="margin:20px 0 0;font-size:13px;color:#4A5A66">Répondez directement à cet e-mail pour écrire à l’expéditeur. Tous les messages : <a href="${siteUrl()}/admin/messages">/admin/messages</a></p></div></body></html>`

    const admins = await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true } })
    const results = await Promise.allSettled(admins.map((a) => sendMail(a.email, subject, html, lines.join('\n'), d.email)))
    results.forEach((r) => r.status === 'rejected' && console.error('Inquiry email failed:', r.reason))

    return ok({ id: inquiry.id })
  }, 'errGeneric')
}
