'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from './action'
import { requireRole } from './guards'
import { createUploadUrl, deleteObject, publicKeyFromUrl, publicUrl } from './r2'

// Content editors (spec §7: admin + media).
const EDITORS = ['admin', 'media'] as const
const folders = { team: 'team', partner: 'partners', event: 'events', dossier: 'documents' } as const
type Target = keyof typeof folders

export async function getMediaUploadUrl(input: { target: Target; contentType: string; size: number }) {
  return run(async () => {
    await requireRole(...EDITORS)
    const d = z.object({ target: z.enum(['team', 'partner', 'event', 'dossier']), contentType: z.string().max(100), size: z.number().int() }).parse(input)
    const kind = d.target === 'dossier' ? 'document' : 'image'
    const { key, uploadUrl } = await createUploadUrl({ bucket: 'public', kind, folder: folders[d.target], contentType: d.contentType, size: d.size })
    return ok({ key, uploadUrl })
  }, 'Fichier refusé (type ou taille).')
}

const keyFor = (target: Target) => new RegExp(`^${folders[target]}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`)

/** Best effort: the old file is removed from R2 after the new one is saved. */
async function removeOld(url: string | null | undefined) {
  const key = publicKeyFromUrl(url)
  if (key) await deleteObject('public', key).catch((e) => console.error('Old file not deleted:', e))
}

function refreshSite() {
  revalidatePath('/[locale]', 'layout')
  revalidatePath('/admin', 'layout')
}

/** Saves (or clears, with key = null) the photo of a team member or the logo of a partner. */
export async function setImage(input: { entity: 'team' | 'partner' | 'event'; id: string; key: string | null }) {
  return run(async () => {
    const { user } = await requireRole(...EDITORS)
    const d = z.object({ entity: z.enum(['team', 'partner', 'event']), id: z.uuid(), key: z.string().nullable() }).parse(input)
    if (d.key && !keyFor(d.entity).test(d.key)) return fail('Fichier invalide.')
    const url = d.key ? publicUrl(d.key) : null

    let previous: string | null
    if (d.entity === 'team') {
      const before = await prisma.teamMember.findUnique({ where: { id: d.id }, select: { photoUrl: true } })
      if (!before) return fail('Membre introuvable.')
      previous = before.photoUrl
      await prisma.teamMember.update({ where: { id: d.id }, data: { photoUrl: url } })
    } else if (d.entity === 'event') {
      const before = await prisma.event.findUnique({ where: { id: d.id }, select: { coverUrl: true } })
      if (!before) return fail('Événement introuvable.')
      previous = before.coverUrl
      await prisma.event.update({ where: { id: d.id }, data: { coverUrl: url } })
    } else {
      const before = await prisma.partner.findUnique({ where: { id: d.id }, select: { logoUrl: true } })
      if (!before) return fail('Partenaire introuvable.')
      previous = before.logoUrl
      await prisma.partner.update({ where: { id: d.id }, data: { logoUrl: url } })
    }
    await prisma.auditLog.create({ data: { userId: user.id, action: `${d.entity}.image`, entity: d.entity, entityId: d.id, payload: { url } } })
    if (previous !== url) await removeOld(previous)
    refreshSite()
    return ok({ url })
  }, 'L’enregistrement de l’image a échoué.')
}

/** Sponsorship pack PDF shown on /soutenir/sponsoring (site_settings.dossier_url). */
export async function setDossier(input: { key: string | null }) {
  return run(async () => {
    const { user } = await requireRole(...EDITORS)
    const { key } = z.object({ key: z.string().nullable() }).parse(input)
    if (key && !keyFor('dossier').test(key)) return fail('Fichier invalide.')
    const before = await prisma.siteSetting.findUnique({ where: { key: 'dossier_url' } })
    if (key) {
      const value = publicUrl(key)
      await prisma.siteSetting.upsert({ where: { key: 'dossier_url' }, create: { key: 'dossier_url', value }, update: { value } })
    } else {
      await prisma.siteSetting.deleteMany({ where: { key: 'dossier_url' } })
    }
    await prisma.auditLog.create({ data: { userId: user.id, action: 'settings.dossier', entity: 'site_setting', entityId: 'dossier_url', payload: { key } } })
    await removeOld(before?.value)
    refreshSite()
    return ok(null)
  }, 'L’enregistrement du dossier a échoué.')
}
