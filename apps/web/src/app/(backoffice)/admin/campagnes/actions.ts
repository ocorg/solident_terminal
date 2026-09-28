'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { FUNDRAISING_KEYS } from '@/lib/fundraising'
import { requireRole } from '@/lib/guards'

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

const schema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug').max(80),
  titleFr: z.string().trim().min(3).max(120),
  titleAr: text(120),
  titleEn: text(120),
  summaryFr: text(1000),
  summaryAr: text(1000),
  summaryEn: text(1000),
  goalDh: z.number().int().min(100).max(100_000_000),
  startsOn: z.iso.date(),
  endsOn: z.union([z.literal(''), z.iso.date()]).optional(),
  isActive: z.boolean(),
  actionId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
})

export type CampaignInput = z.input<typeof schema>

export async function saveCampaign(input: CampaignInput) {
  return run(async () => {
    const { user } = await requireRole('admin', 'treasurer')
    const { id, startsOn, endsOn, ...rest } = schema.parse(input)
    if (endsOn && endsOn < startsOn) return fail('La date de fin doit être après la date de début.')
    const clash = await prisma.campaign.findFirst({ where: { slug: rest.slug, ...(id && { NOT: { id } }) }, select: { id: true } })
    if (clash) return fail('Ce slug est déjà utilisé par une autre campagne.')

    const data = { ...rest, startsOn: new Date(`${startsOn}T00:00:00Z`), endsOn: endsOn ? new Date(`${endsOn}T00:00:00Z`) : null }
    const saved = await prisma.$transaction(async (tx) => {
      const c = id ? await tx.campaign.update({ where: { id }, data }) : await tx.campaign.create({ data })
      await tx.auditLog.create({ data: { userId: user.id, action: id ? 'campaign.update' : 'campaign.create', entity: 'campaign', entityId: c.id, payload: { slug: c.slug, goalDh: c.goalDh, isActive: c.isActive } } })
      return c
    })
    revalidatePath('/[locale]', 'layout')
    revalidatePath('/admin', 'layout')
    return ok({ id: saved.id })
  }, 'L’enregistrement a échoué.')
}

const fundraisingSchema = z.object({ open: z.boolean(), authorization: z.string().trim().max(200) })

/** Opens or closes public fundraising (RIB, donation form, live bars) on the whole site. */
export async function saveFundraising(input: z.input<typeof fundraisingSchema>) {
  return run(async () => {
    const { user } = await requireRole('admin', 'treasurer')
    const d = fundraisingSchema.parse(input)
    if (d.open && d.authorization.length < 3) return fail('Indiquez la référence de l’autorisation avant d’ouvrir la collecte.')
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of [
        [FUNDRAISING_KEYS.open, String(d.open)],
        [FUNDRAISING_KEYS.authorization, d.authorization],
      ]) {
        await tx.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
      }
      await tx.auditLog.create({ data: { userId: user.id, action: d.open ? 'fundraising.open' : 'fundraising.close', entity: 'site_settings', entityId: FUNDRAISING_KEYS.open, payload: { authorization: d.authorization } } })
    })
    revalidatePath('/[locale]', 'layout')
    revalidatePath('/admin', 'layout')
    return ok({ open: d.open })
  }, 'L’enregistrement a échoué.')
}
