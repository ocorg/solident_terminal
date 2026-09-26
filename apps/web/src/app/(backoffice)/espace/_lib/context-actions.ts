'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma, type ContextType } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { createUploadUrl, deleteObject, publicKeyFromUrl, publicUrl } from '@/lib/r2'
import { isContextManager, notify, requireMember } from '@/lib/space'

const ctxType = z.enum(['project', 'cellule'])
const path = (t: ContextType, id?: string) => `/espace/${t === 'project' ? 'projets' : 'cellules'}${id ? `/${id}` : ''}`
function refresh(t: ContextType, id?: string) {
  revalidatePath('/espace', 'layout')
  revalidatePath(path(t, id))
}
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)
const optDay = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null))

const projectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: optText(5000),
  status: z.enum(['actif', 'en_pause', 'bloque', 'termine']),
  startDate: optDay,
  endDate: optDay,
  parentProjectId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
  isMultiActivite: z.boolean(),
})

export async function saveProject(input: z.input<typeof projectSchema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = projectSchema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez le nom du projet.')
    const { id, ...data } = parsed.data
    if (id && data.parentProjectId === id) return fail('Un projet ne peut pas être son propre parent.')
    if (id ? !(await isContextManager(user, 'project', id)) : !user.isSpaceAdmin) return fail('Action réservée aux responsables.')
    const p = id ? await prisma.project.update({ where: { id }, data }) : await prisma.project.create({ data: { ...data, approvalStatus: 'approuve', proposedById: user.id, positions: { create: [{ name: 'Chef de Projet' }, { name: 'Membre' }] } } })
    refresh('project', p.id)
    return ok({ id: p.id })
  }, 'L’enregistrement a échoué.')
}

const celluleSchema = z.object({ id: z.uuid().optional(), name: z.string().trim().min(2).max(120), description: optText(5000) })

export async function saveCellule(input: z.input<typeof celluleSchema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = celluleSchema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez le nom de la cellule.')
    const { id, ...data } = parsed.data
    if (id ? !(await isContextManager(user, 'cellule', id)) : !user.isSpaceAdmin) return fail('Action réservée aux responsables.')
    const c = id ? await prisma.cellule.update({ where: { id }, data }) : await prisma.cellule.create({ data: { ...data, positions: { create: [{ name: 'Responsable' }, { name: 'Membre' }] } } })
    refresh('cellule', c.id)
    return ok({ id: c.id })
  }, 'L’enregistrement a échoué.')
}

/** Space admins only; the context's tasks are deleted with it (they would be orphaned otherwise). */
export async function deleteContext(input: { type: string; id: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, id: z.uuid() }).parse(input)
    if (!user.isSpaceAdmin) return fail('Suppression réservée aux administrateurs de l’espace.')
    const img = d.type === 'project' ? (await prisma.project.findUnique({ where: { id: d.id } }))?.imageUrl : (await prisma.cellule.findUnique({ where: { id: d.id } }))?.imageUrl
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { contextType: d.type, contextId: d.id } }),
      prisma.taskContext.deleteMany({ where: { contextType: d.type, contextId: d.id } }),
      d.type === 'project' ? prisma.project.delete({ where: { id: d.id } }) : prisma.cellule.delete({ where: { id: d.id } }),
      prisma.auditLog.create({ data: { userId: user.id, action: `${d.type}.delete`, entity: d.type, entityId: d.id } }),
    ])
    const key = publicKeyFromUrl(img)
    if (key) await deleteObject('public', key).catch(() => {})
    refresh(d.type)
    return ok(null)
  }, 'La suppression a échoué.')
}

export async function addPosition(input: { type: string; contextId: string; name: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, contextId: z.uuid(), name: z.string().trim().min(2).max(60) }).safeParse(input)
    if (!d.success) return fail('Nom de poste invalide.')
    const { type, contextId, name } = d.data
    if (!(await isContextManager(user, type, contextId))) return fail('Action réservée aux responsables.')
    if (type === 'project') await prisma.projectPosition.create({ data: { projectId: contextId, name } })
    else await prisma.cellulePosition.create({ data: { celluleId: contextId, name } })
    refresh(type, contextId)
    return ok(null)
  }, 'L’ajout du poste a échoué.')
}

export async function removePosition(input: { type: string; contextId: string; positionId: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, contextId: z.uuid(), positionId: z.uuid() }).parse(input)
    if (!(await isContextManager(user, d.type, d.contextId))) return fail('Action réservée aux responsables.')
    const used = d.type === 'project' ? await prisma.projectMember.count({ where: { positionId: d.positionId } }) : await prisma.celluleMember.count({ where: { positionId: d.positionId } })
    if (used) return fail('Ce poste est occupé : changez d’abord le poste des personnes concernées.')
    if (d.type === 'project') await prisma.projectPosition.delete({ where: { id: d.positionId } })
    else await prisma.cellulePosition.delete({ where: { id: d.positionId } })
    refresh(d.type, d.contextId)
    return ok(null)
  }, 'La suppression du poste a échoué.')
}

/** Adds a member or changes their position. */
export async function setMember(input: { type: string; contextId: string; userId: string; positionId: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, contextId: z.uuid(), userId: z.uuid(), positionId: z.uuid() }).parse(input)
    if (!(await isContextManager(user, d.type, d.contextId))) return fail('Action réservée aux responsables.')
    let isNew = false
    let contextName = ''
    if (d.type === 'project') {
      const pos = await prisma.projectPosition.findFirst({ where: { id: d.positionId, projectId: d.contextId }, include: { project: true } })
      if (!pos) return fail('Poste invalide.')
      contextName = pos.project.name
      isNew = !(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: d.contextId, userId: d.userId } } }))
      await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: d.contextId, userId: d.userId } }, create: { projectId: d.contextId, userId: d.userId, positionId: d.positionId }, update: { positionId: d.positionId } })
    } else {
      const pos = await prisma.cellulePosition.findFirst({ where: { id: d.positionId, celluleId: d.contextId }, include: { cellule: true } })
      if (!pos) return fail('Poste invalide.')
      contextName = pos.cellule.name
      isNew = !(await prisma.celluleMember.findUnique({ where: { celluleId_userId: { celluleId: d.contextId, userId: d.userId } } }))
      await prisma.celluleMember.upsert({ where: { celluleId_userId: { celluleId: d.contextId, userId: d.userId } }, create: { celluleId: d.contextId, userId: d.userId, positionId: d.positionId }, update: { positionId: d.positionId } })
    }
    if (isNew) await notify([d.userId], `${d.type}_member_added`, `${user.name} vous a ajouté·e à « ${contextName} »`, d.contextId, user.id)
    refresh(d.type, d.contextId)
    return ok(null)
  }, 'La mise à jour du membre a échoué.')
}

export async function removeMember(input: { type: string; contextId: string; userId: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, contextId: z.uuid(), userId: z.uuid() }).parse(input)
    if (!(await isContextManager(user, d.type, d.contextId))) return fail('Action réservée aux responsables.')
    if (d.type === 'project') await prisma.projectMember.deleteMany({ where: { projectId: d.contextId, userId: d.userId } })
    else await prisma.celluleMember.deleteMany({ where: { celluleId: d.contextId, userId: d.userId } })
    refresh(d.type, d.contextId)
    return ok(null)
  }, 'Le retrait a échoué.')
}

// ───────── cover image (managers of the context) ─────────
export async function getCoverUploadUrl(input: { type: string; contextId: string; contentType: string; size: number }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, contextId: z.uuid(), contentType: z.string().max(100), size: z.number().int() }).parse(input)
    if (!(await isContextManager(user, d.type, d.contextId))) return fail('Action réservée aux responsables.')
    const { key, uploadUrl } = await createUploadUrl({ bucket: 'public', kind: 'image', folder: `espace/${d.type}s`, contentType: d.contentType, size: d.size })
    return ok({ key, uploadUrl })
  }, 'Fichier refusé.')
}

export async function setCover(input: { type: string; contextId: string; key: string | null }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ type: ctxType, contextId: z.uuid(), key: z.string().nullable() }).parse(input)
    if (!(await isContextManager(user, d.type, d.contextId))) return fail('Action réservée aux responsables.')
    if (d.key && !new RegExp(`^espace/${d.type}s/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(d.key)) return fail('Fichier invalide.')
    const url = d.key ? publicUrl(d.key) : null
    const before = d.type === 'project' ? (await prisma.project.findUnique({ where: { id: d.contextId } }))?.imageUrl : (await prisma.cellule.findUnique({ where: { id: d.contextId } }))?.imageUrl
    if (d.type === 'project') await prisma.project.update({ where: { id: d.contextId }, data: { imageUrl: url } })
    else await prisma.cellule.update({ where: { id: d.contextId }, data: { imageUrl: url } })
    const oldKey = publicKeyFromUrl(before)
    if (oldKey && before !== url) await deleteObject('public', oldKey).catch(() => {})
    refresh(d.type, d.contextId)
    return ok(null)
  }, 'L’image n’a pas pu être enregistrée.')
}
