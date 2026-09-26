'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'
import { broadcast } from '@/lib/pusher'
import { channels } from '@/lib/realtime'
import { registrationState, takenPlaces } from '@/lib/registrations'
import { localInputToDate } from '@/lib/tz'

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)

const schema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  type: z.enum(['caravane', 'scientifique', 'solifun', 'ambassadeurs', 'autre']),
  programmeId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
  titleFr: z.string().trim().min(3).max(140),
  titleAr: opt(140),
  titleEn: opt(140),
  bodyFr: opt(5000),
  bodyAr: opt(5000),
  bodyEn: opt(5000),
  startsAt: localDateTime,
  endsAt: z.union([z.literal(''), localDateTime]).optional(),
  location: opt(160),
  capacity: z.union([z.literal(''), z.coerce.number().int().min(1).max(100_000)]).optional().transform((v) => (v === '' || v === undefined ? null : v)),
  registrationOpen: z.boolean(),
  isPublished: z.boolean(),
})

export type EventInput = z.input<typeof schema>

export async function saveEvent(input: EventInput) {
  return run(async () => {
    const { user } = await requireRole('admin', 'media')
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez les champs (titre FR, slug, dates).')
    const { id, startsAt, endsAt, ...rest } = parsed.data
    const start = localInputToDate(startsAt)
    const end = endsAt ? localInputToDate(endsAt) : null
    if (end && end < start) return fail('La fin doit être après le début.')
    const clash = await prisma.event.findFirst({ where: { slug: rest.slug, ...(id && { NOT: { id } }) }, select: { id: true } })
    if (clash) return fail('Ce slug est déjà utilisé par un autre événement.')
    if (id && rest.capacity !== null) {
      const taken = await takenPlaces(prisma, id)
      if (rest.capacity < taken) return fail(`Déjà ${taken} inscrits : la capacité ne peut pas être inférieure.`)
    }

    const data = { ...rest, startsAt: start, endsAt: end }
    const e = await prisma.$transaction(async (tx) => {
      const saved = id ? await tx.event.update({ where: { id }, data }) : await tx.event.create({ data: { ...data, createdById: user.id } })
      await tx.auditLog.create({ data: { userId: user.id, action: id ? 'event.update' : 'event.create', entity: 'event', entityId: saved.id, payload: { slug: saved.slug, registrationOpen: saved.registrationOpen, isPublished: saved.isPublished } } })
      return saved
    })

    // Open pages see capacity / open-closed changes immediately.
    const state = registrationState(e, await takenPlaces(prisma, e.id))
    await broadcast(channels.event(e.id), 'places-updated', { placesLeft: state.placesLeft, registrationOpen: state.open }).catch(() => {})
    revalidatePath('/[locale]', 'layout')
    revalidatePath('/admin', 'layout')
    return ok({ id: e.id })
  }, 'L’enregistrement a échoué.')
}
