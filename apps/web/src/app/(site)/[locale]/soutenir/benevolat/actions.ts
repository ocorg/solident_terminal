'use server'

import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { sendMail } from '@/lib/mail'
import { normalizePhone } from '@/lib/phone'
import { allow } from '@/lib/rate-limit'
import { siteUrl } from '@/lib/site-url'

export type VolunteerError = 'errFields' | 'errPhone' | 'errTooMany' | 'errGeneric'

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

// Field ids and rules from spec §5 (vol-*): name + phone required.
const schema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(''), z.email().trim().toLowerCase()]).optional().transform((v) => v || null),
  city: opt(80),
  profile: z.enum(['etudiant', 'praticien', 'public']),
  skills: opt(500),
  availability: opt(300),
  motivation: opt(1500),
  website: z.string().max(0).optional(), // honeypot
})

/** Spec §6 volunteer flow: saved as "new", HR (and admins) emailed. */
export async function applyAsVolunteer(input: z.input<typeof schema>) {
  return run(async () => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('errFields')
    const { website: _hp, ...d } = parsed.data
    const phone = normalizePhone(d.phone)
    if (!phone) return fail('errPhone')
    if (!(await allow('volunteer', 3, 600))) return fail('errTooMany')

    await prisma.volunteerApplication.create({ data: { ...d, phone } })

    const staff = await prisma.user.findMany({ where: { role: { in: ['hr', 'admin'] }, isActive: true }, select: { email: true } })
    const lines = [`Nom : ${d.fullName}`, `Téléphone : ${phone}`, d.email && `E-mail : ${d.email}`, d.city && `Ville : ${d.city}`, `Profil : ${d.profile}`, d.skills && `Compétences : ${d.skills}`, d.availability && `Disponibilités : ${d.availability}`, d.motivation && `\n${d.motivation}`].filter(Boolean) as string[]
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
    const html = `<!doctype html><html lang="fr"><body style="font-family:Montserrat,Arial,sans-serif;color:#123A4F;background:#FBF8F2;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;line-height:1.6"><p style="margin:0 0 12px;font-weight:700;font-size:18px;color:#1E5470">Nouvelle candidature bénévole</p>${lines.map((l) => `<div style="white-space:pre-wrap">${esc(l)}</div>`).join('')}<p style="margin-top:20px;font-size:13px"><a href="${siteUrl()}/admin/benevoles">Voir dans /admin/benevoles</a></p></div></body></html>`
    const results = await Promise.allSettled(staff.map((s) => sendMail(s.email, `Candidature bénévole : ${d.fullName}`, html, lines.join('\n'), d.email ?? undefined)))
    results.forEach((r) => r.status === 'rejected' && console.error('Volunteer email failed:', r.reason))

    return ok(null)
  }, 'errGeneric')
}
