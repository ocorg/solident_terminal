'use server'

import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { donationAlertEmail, donationThanksEmail } from '@/lib/donation-emails'
import { localized } from '@/lib/localized'
import { sendMail } from '@/lib/mail'
import { createUploadUrl, UPLOAD_RULES } from '@/lib/r2'
import { allow } from '@/lib/rate-limit'

// Error codes are translated on the client (messages Donate.err*).
export type DonateError = 'errGeneric' | 'errTooMany' | 'errFile' | 'errCampaign' | 'errName' | 'errAmount'

export async function getProofUploadUrl(input: { contentType: string; size: number }) {
  return run(async () => {
    const { contentType, size } = z.object({ contentType: z.string().max(100), size: z.number().int() }).parse(input)
    const rule = UPLOAD_RULES.proof
    if (!(rule.types as readonly string[]).includes(contentType) || size <= 0 || size > rule.maxBytes) return fail('errFile')
    if (!(await allow('proof-upload', 5, 600))) return fail('errTooMany')
    const month = new Date().toISOString().slice(0, 7)
    const { key, uploadUrl } = await createUploadUrl({ bucket: 'private', kind: 'proof', folder: `proofs/${month}`, contentType, size })
    return ok({ key, uploadUrl })
  }, 'errGeneric')
}

const PROOF_KEY = /^proofs\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/

const declareSchema = z
  .object({
    locale: z.enum(['fr', 'ar', 'en']),
    campaignId: z.uuid(),
    donorName: z.string().trim().max(80).optional(),
    showOnWall: z.boolean(),
    amountDh: z.number().int(),
    email: z.union([z.literal(''), z.email().trim().toLowerCase()]).optional(),
    phone: z.string().trim().max(30).optional(),
    proofKey: z.string().regex(PROOF_KEY).optional(),
    website: z.string().max(0).optional(), // honeypot
  })

export async function declareDonation(input: z.input<typeof declareSchema>) {
  return run(async () => {
    const d = declareSchema.parse(input)
    if (d.amountDh < 10 || d.amountDh > 10_000_000) return fail('errAmount')
    if (d.showOnWall && (!d.donorName || d.donorName.length < 2)) return fail('errName')
    if (!(await allow('donation-declare', 5, 600))) return fail('errTooMany')

    const campaign = await prisma.campaign.findFirst({ where: { id: d.campaignId, isActive: true } })
    if (!campaign) return fail('errCampaign')

    await prisma.donation.create({
      data: {
        campaignId: campaign.id,
        donorName: d.donorName || null,
        isAnonymous: !d.showOnWall,
        amountDh: d.amountDh,
        email: d.email || null,
        phone: d.phone || null,
        proofKey: d.proofKey ?? null,
        source: 'form',
        status: 'pending',
      },
    })

    // Emails never block the declaration: it is saved, and the treasurer also sees it in /admin/dons.
    const title = localized(campaign, 'title', d.locale)
    const staff = await prisma.user.findMany({ where: { role: { in: ['admin', 'treasurer'] }, isActive: true }, select: { email: true } })
    const alert = donationAlertEmail({ donorName: d.donorName || null, amountDh: d.amountDh, campaign: campaign.titleFr, email: d.email || null, phone: d.phone || null, hasProof: Boolean(d.proofKey) })
    const jobs = staff.map((s) => sendMail(s.email, alert.subject, alert.html, alert.text))
    if (d.email) {
      const thanks = donationThanksEmail(d.locale, d.donorName ?? '', d.amountDh, title)
      jobs.push(sendMail(d.email, thanks.subject, thanks.html, thanks.text))
    }
    const results = await Promise.allSettled(jobs)
    results.forEach((r) => r.status === 'rejected' && console.error('Donation email failed:', r.reason))

    return ok({ amountDh: d.amountDh })
  }, 'errGeneric')
}
