'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** "35.0017, -5.9053" as copied from Google Maps → { lat, lng }; empty → nulls. */
function parseCoords(raw: string | undefined): { lat: number | null; lng: number | null } | 'invalid' | 'swapped' {
  const s = (raw ?? '').trim()
  if (!s) return { lat: null, lng: null }
  const m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return 'invalid'
  const lat = Number(m[1])
  const lng = Number(m[2])
  // Morocco and neighbours: latitude ~20–37 N, longitude ~-18 to -1 (W). Catches swapped values.
  if (lat >= -18 && lat <= -1 && lng >= 20 && lng <= 37) return 'swapped'
  if (lat < 15 || lat > 40 || lng < -20 || lng > 5) return 'invalid'
  return { lat, lng }
}

const actionSchema = z.object({
  id: z.uuid().optional(),
  slug,
  programmeId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
  titleFr: z.string().trim().min(3).max(160),
  titleAr: opt(160),
  titleEn: opt(160),
  bodyFr: opt(8000),
  bodyAr: opt(8000),
  bodyEn: opt(8000),
  dateStart: day,
  dateEnd: z.union([z.literal(''), day]).optional(),
  location: opt(160),
  coords: z.string().max(80).optional(),
  beneficiariesCount: z.union([z.literal(''), z.coerce.number().int().min(0).max(10_000_000)]).optional().transform((v) => (v === '' || v === undefined ? null : v)),
  partnerIds: z.array(z.uuid()).max(50),
  isPublished: z.boolean(),
})
export type ActionInput = z.input<typeof actionSchema>

function refresh() {
  revalidatePath('/[locale]', 'layout')
  revalidatePath('/admin/contenu', 'layout')
}

export async function saveAction(input: ActionInput) {
  return run(async () => {
    const { user } = await requireRole('admin', 'media')
    const parsed = actionSchema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez les champs (titre FR, slug, dates).')
    const { id, partnerIds, coords, dateStart, dateEnd, ...rest } = parsed.data
    const c = parseCoords(coords)
    if (c === 'invalid') return fail('Coordonnées invalides. Collez-les depuis Google Maps, ex. « 35.0017, -5.9053 ».')
    if (c === 'swapped') return fail('Coordonnées inversées : la latitude (≈ 30 à 36) doit venir en premier, ex. « 35.0017, -5.9053 ».')
    const start = new Date(`${dateStart}T00:00:00Z`)
    const end = dateEnd ? new Date(`${dateEnd}T00:00:00Z`) : null
    if (end && end < start) return fail('La date de fin doit être après la date de début.')
    const clash = await prisma.action.findFirst({ where: { slug: rest.slug, ...(id && { NOT: { id } }) }, select: { id: true } })
    if (clash) return fail('Ce slug est déjà utilisé par une autre action.')

    const data = { ...rest, ...c, dateStart: start, dateEnd: end }
    const saved = await prisma.$transaction(async (tx) => {
      const a = id ? await tx.action.update({ where: { id }, data }) : await tx.action.create({ data })
      await tx.actionPartner.deleteMany({ where: { actionId: a.id } })
      if (partnerIds.length) await tx.actionPartner.createMany({ data: [...new Set(partnerIds)].map((partnerId) => ({ actionId: a.id, partnerId })) })
      await tx.auditLog.create({ data: { userId: user.id, action: id ? 'action.update' : 'action.create', entity: 'action', entityId: a.id, payload: { slug: a.slug, isPublished: a.isPublished } } })
      return a
    })
    refresh()
    return ok({ id: saved.id })
  }, 'L’enregistrement a échoué.')
}

const programmeSchema = z.object({
  id: z.uuid(),
  titleFr: z.string().trim().min(2).max(120),
  titleAr: opt(120),
  titleEn: opt(120),
  summaryFr: opt(600),
  summaryAr: opt(600),
  summaryEn: opt(600),
  bodyFr: opt(8000),
  bodyAr: opt(8000),
  bodyEn: opt(8000),
  order: z.number().int().min(0).max(999),
  isActive: z.boolean(),
})
export type ProgrammeInput = z.input<typeof programmeSchema>

export async function saveProgramme(input: ProgrammeInput) {
  return run(async () => {
    const { user } = await requireRole('admin', 'media')
    const parsed = programmeSchema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez les champs (titre FR obligatoire).')
    const { id, ...data } = parsed.data
    await prisma.$transaction([
      prisma.programme.update({ where: { id }, data }),
      prisma.auditLog.create({ data: { userId: user.id, action: 'programme.update', entity: 'programme', entityId: id, payload: { isActive: data.isActive } } }),
    ])
    refresh()
    return ok({ id })
  }, 'L’enregistrement a échoué.')
}
