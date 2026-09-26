'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
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
