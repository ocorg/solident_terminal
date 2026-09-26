'use server'

import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { localized } from '@/lib/localized'
import { sendMail } from '@/lib/mail'
import { normalizePhone } from '@/lib/phone'
import { allow } from '@/lib/rate-limit'
import { register } from '@/lib/registrations'
import { siteUrl } from '@/lib/site-url'

export type RegistrationError = 'errDuplicate' | 'errFull' | 'errClosed' | 'errPhone' | 'errFields' | 'errTooMany' | 'errGeneric'

// Field ids and rules from spec §5 (reg-*)
const schema = z.object({
  locale: z.enum(['fr', 'ar', 'en']),
  eventId: z.uuid(),
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(''), z.email().trim().toLowerCase()]).optional(),
  city: z.string().trim().max(80).optional(),
  profile: z.enum(['etudiant', 'praticien', 'public']),
  note: z.string().trim().max(500).optional(),
  website: z.string().max(0).optional(), // honeypot
})

const confirm = {
  fr: (name: string, title: string, url: string) => ({ subject: `Inscription confirmée : ${title}`, text: `Bonjour ${name},\n\nVotre inscription à « ${title} » est bien enregistrée. L’équipe Solident vous recontactera si besoin.\n\nDétails : ${url}\n\nAssociation Solident` }),
  ar: (name: string, title: string, url: string) => ({ subject: `تأكيد التسجيل: ${title}`, text: `مرحباً ${name}،\n\nتم تسجيلك في « ${title} ». سيتواصل معك فريق سوليدنت عند الحاجة.\n\nالتفاصيل: ${url}\n\nجمعية سوليدنت` }),
  en: (name: string, title: string, url: string) => ({ subject: `Registration confirmed: ${title}`, text: `Hello ${name},\n\nYour registration for “${title}” is confirmed. The Solident team will contact you if needed.\n\nDetails: ${url}\n\nSolident Association` }),
}

export async function registerForEvent(input: z.input<typeof schema>) {
  return run(async () => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('errFields')
    const d = parsed.data
    const phone = normalizePhone(d.phone)
    if (!phone) return fail('errPhone')
    if (!(await allow('event-register', 10, 600))) return fail('errTooMany')

    const result = await register({
      eventId: d.eventId,
      fullName: d.fullName,
      phone,
      email: d.email || null,
      city: d.city || null,
      profile: d.profile,
      note: d.note || null,
    })
    if (result !== 'ok') return fail(result)

    if (d.email) {
      const e = await prisma.event.findUnique({ where: { id: d.eventId } })
      if (e) {
        const m = confirm[d.locale](d.fullName, localized(e, 'title', d.locale), `${siteUrl()}/${d.locale}/evenements/${e.slug}`)
        const html = `<!doctype html><html lang="${d.locale}" dir="${d.locale === 'ar' ? 'rtl' : 'ltr'}"><body style="font-family:Montserrat,Arial,sans-serif;color:#123A4F;background:#FBF8F2;padding:32px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;line-height:1.6;white-space:pre-line">${m.text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</div></body></html>`
        await sendMail(d.email, m.subject, html, m.text).catch((err) => console.error('Registration email failed:', err))
      }
    }
    return ok(null)
  }, 'errGeneric')
}
