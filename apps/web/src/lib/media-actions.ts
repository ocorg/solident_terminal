'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from './action'
import { requireRole } from './guards'
import { createUploadUrl, deleteObject, publicKeyFromUrl, publicUrl } from './r2'

// Content editors (spec §7: admin + media).
const EDITORS = ['admin', 'media'] as const
const folders = { team: 'team', partner: 'partners', event: 'events', action: 'actions', programme: 'programmes', dossier: 'documents' } as const
type Target = keyof typeof folders

export async function getMediaUploadUrl(input: { target: Target; contentType: string; size: number }) {
  return run(async () => {
    await requireRole(...EDITORS)
    const d = z.object({ target: z.enum(['team', 'partner', 'event', 'action', 'programme', 'dossier']), contentType: z.string().max(100), size: z.number().int() }).parse(input)
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
export async function setImage(input: { entity: 'team' | 'partner' | 'event' | 'action' | 'programme'; id: string; key: string | null }) {
  return run(async () => {
    const { user } = await requireRole(...EDITORS)
    const d = z.object({ entity: z.enum(['team', 'partner', 'event', 'action', 'programme']), id: z.uuid(), key: z.string().nullable() }).parse(input)
    if (d.key && !keyFor(d.entity).test(d.key)) return fail('Fichier invalide.')
    const url = d.key ? publicUrl(d.key) : null

    let previous: string | null
    if (d.entity === 'team') {
      const before = await prisma.teamMember.findUnique({ where: { id: d.id }, select: { photoUrl: true } })
      if (!before) return fail('Membre introuvable.')
      previous = before.photoUrl
      await prisma.teamMember.update({ where: { id: d.id }, data: { photoUrl: url } })
    } else if (d.entity === 'action') {
      const before = await prisma.action.findUnique({ where: { id: d.id }, select: { coverUrl: true } })
      if (!before) return fail('Action introuvable.')
      previous = before.coverUrl
      await prisma.action.update({ where: { id: d.id }, data: { coverUrl: url } })
    } else if (d.entity === 'programme') {
      const before = await prisma.programme.findUnique({ where: { id: d.id }, select: { coverUrl: true } })
      if (!before) return fail('Programme introuvable.')
      previous = before.coverUrl
      await prisma.programme.update({ where: { id: d.id }, data: { coverUrl: url } })
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

/** Adds a photo to an action gallery (media table, spec §5). */
export async function addGalleryImage(input: { actionId: string; key: string; width?: number; height?: number }) {
  return run(async () => {
    const { user } = await requireRole(...EDITORS)
    const d = z.object({ actionId: z.uuid(), key: z.string(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional() }).parse(input)
    if (!keyFor('action').test(d.key)) return fail('Fichier invalide.')
    const action = await prisma.action.findUnique({ where: { id: d.actionId }, select: { titleFr: true, titleAr: true, titleEn: true } })
    if (!action) return fail('Action introuvable.')
    const last = await prisma.media.aggregate({ where: { ownerType: 'action', ownerId: d.actionId }, _max: { order: true } })
    const m = await prisma.media.create({
      data: {
        ownerType: 'action', ownerId: d.actionId, r2Key: d.key, url: publicUrl(d.key), width: d.width, height: d.height,
        order: (last._max.order ?? 0) + 1,
        // Default alt text = action title in each language; editable later.
        altFr: action.titleFr, altAr: action.titleAr, altEn: action.titleEn,
      },
    })
    await prisma.auditLog.create({ data: { userId: user.id, action: 'media.add', entity: 'media', entityId: m.id, payload: { actionId: d.actionId } } })
    refreshSite()
    return ok({ id: m.id })
  }, 'L’ajout de la photo a échoué.')
}

export async function deleteGalleryImage(input: { id: string }) {
  return run(async () => {
    const { user } = await requireRole(...EDITORS)
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const m = await prisma.media.delete({ where: { id } })
    await prisma.auditLog.create({ data: { userId: user.id, action: 'media.delete', entity: 'media', entityId: id, payload: { ownerId: m.ownerId } } })
    await deleteObject('public', m.r2Key).catch((e) => console.error('Photo not deleted from R2:', e))
    refreshSite()
    return ok(null)
  }, 'La suppression a échoué.')
}
