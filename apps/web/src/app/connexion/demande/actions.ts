'use server'

import { z } from 'zod'
import { prisma } from '@solident/db'
import { accessRequestEmail, sendMail } from '@/lib/mail'

const schema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(80),
  email: z.email('Adresse e-mail invalide').trim().toLowerCase(),
  message: z.string().trim().max(500).optional(),
  website: z.string().max(0).optional(), // honeypot: humans leave it empty
})

export async function requestAccess(input: z.input<typeof schema>) {
  const { name, email, message, website } = schema.parse(input)
  if (website) return { status: 'success' as const, data: { email } }

  // Existing accounts (active or pending) get the same answer, so the form never reveals who is a member.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!existing) {
    await prisma.user.create({ data: { name, email, role: 'member', isActive: false } })

    const admins = await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true } })
    const mail = accessRequestEmail({ name, email, message })
    // The request is saved even if the alert email fails; admins also see pending users in the database.
    await Promise.allSettled(admins.map((a) => sendMail(a.email, mail.subject, mail.html, mail.text))).then((results) =>
      results.forEach((r) => r.status === 'rejected' && console.error('Access-request alert failed:', r.reason)),
    )
  }

  return { status: 'success' as const, data: { email } }
}
