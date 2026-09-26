'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { isContextManager, notify, requireMember, taskRights } from '@/lib/space'
import { taskStatusLabel } from '@/lib/space-labels'
import { localInputToDate } from '@/lib/tz'

const due = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)]).optional()
const toDue = (v?: string) => (!v ? null : localInputToDate(v.length === 10 ? `${v}T18:00` : v))

const base = {
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  priority: z.enum(['urgent', 'eleve', 'moyen', 'faible']),
  dueDate: due,
  assigneeIds: z.array(z.uuid()).max(30),
}
const createSchema = z.object({ ...base, contextType: z.enum(['project', 'cellule']), contextId: z.uuid() })
const updateSchema = z.object({ ...base, id: z.uuid() })

async function isContextMember(userId: string, type: 'project' | 'cellule', id: string) {
  return type === 'project'
    ? !!(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: id, userId } } }))
    : !!(await prisma.celluleMember.findUnique({ where: { celluleId_userId: { celluleId: id, userId } } }))
}

function refresh(id?: string) {
  revalidatePath('/espace', 'layout')
  if (id) revalidatePath(`/espace/taches/${id}`)
}

export async function createTask(input: z.input<typeof createSchema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez le titre et le contexte.')
    const d = parsed.data
    if (!user.isSpaceAdmin && !(await isContextMember(user.id, d.contextType, d.contextId))) return fail('Vous devez faire partie de ce projet ou de cette cellule pour y créer une tâche.')
    const canAssignOthers = await isContextManager(user, d.contextType, d.contextId)
    const assignees = canAssignOthers ? d.assigneeIds : d.assigneeIds.filter((id) => id === user.id)

    const task = await prisma.task.create({
      data: {
        contextType: d.contextType, contextId: d.contextId, title: d.title, description: d.description, priority: d.priority,
        dueDate: toDue(d.dueDate), createdById: user.id, lastUpdatedById: user.id,
        assignees: { create: [...new Set(assignees)].map((userId) => ({ userId })) },
      },
    })
    await notify(assignees, 'task_assigned', `${user.name} vous a assigné la tâche « ${task.title} »`, task.id, user.id)
    refresh()
    return ok({ id: task.id })
  }, 'La création a échoué.')
}

export async function updateTask(input: z.input<typeof updateSchema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez les champs.')
    const d = parsed.data
    const { task, isManager } = await taskRights(user, d.id)
    if (!task) return fail('Tâche introuvable.')
    if (!isManager) return fail('Seuls les responsables du projet ou de la cellule peuvent modifier cette tâche.')

    const before = new Set(task.assignees.map((a) => a.userId))
    const added = d.assigneeIds.filter((id) => !before.has(id))
    await prisma.$transaction([
      prisma.task.update({ where: { id: d.id }, data: { title: d.title, description: d.description, priority: d.priority, dueDate: toDue(d.dueDate), lastUpdatedById: user.id } }),
      prisma.taskAssignee.deleteMany({ where: { taskId: d.id, userId: { notIn: d.assigneeIds } } }),
      prisma.taskAssignee.createMany({ data: added.map((userId) => ({ taskId: d.id, userId })), skipDuplicates: true }),
    ])
    await notify(added, 'task_assigned', `${user.name} vous a assigné la tâche « ${d.title} »`, d.id, user.id)
    refresh(d.id)
    return ok(null)
  }, 'L’enregistrement a échoué.')
}

export async function setTaskStatus(input: { id: string; status: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ id: z.uuid(), status: z.enum(['a_faire', 'en_cours', 'bloque', 'termine']) }).parse(input)
    const { task, isManager, isAssignee } = await taskRights(user, d.id)
    if (!task) return fail('Tâche introuvable.')
    if (!isManager && !isAssignee) return fail('Seuls les personnes assignées et les responsables peuvent changer le statut.')
    if (task.status === d.status) return ok(null)
    const now = new Date()
    await prisma.task.update({
      where: { id: d.id },
      data: {
        status: d.status,
        lastUpdatedById: user.id,
        ...(d.status === 'en_cours' && !task.startedAt && { startedAt: now }),
        completedAt: d.status === 'termine' ? now : null,
      },
    })
    await notify([task.createdById, ...task.assignees.map((a) => a.userId)], 'task_updated', `${user.name} a passé « ${task.title} » en ${taskStatusLabel[d.status]}`, d.id, user.id)
    refresh(d.id)
    return ok(null)
  }, 'Le changement de statut a échoué.')
}

export async function setTaskArchived(input: { id: string; archived: boolean }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ id: z.uuid(), archived: z.boolean() }).parse(input)
    const { task, isManager } = await taskRights(user, d.id)
    if (!task) return fail('Tâche introuvable.')
    if (!isManager) return fail('Seuls les responsables peuvent archiver une tâche.')
    await prisma.task.update({ where: { id: d.id }, data: { archived: d.archived, lastUpdatedById: user.id } })
    refresh(d.id)
    return ok(null)
  }, 'L’archivage a échoué.')
}

export async function deleteTask(input: { id: string }) {
  return run(async () => {
    const user = await requireMember()
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const { task, isManager } = await taskRights(user, id)
    if (!task) return fail('Tâche introuvable.')
    if (!isManager) return fail('Seuls les responsables peuvent supprimer une tâche.')
    await prisma.$transaction([
      prisma.task.delete({ where: { id } }),
      prisma.auditLog.create({ data: { userId: user.id, action: 'task.delete', entity: 'task', entityId: id, payload: { title: task.title } } }),
    ])
    refresh()
    return ok(null)
  }, 'La suppression a échoué.')
}

export async function addComment(input: { taskId: string; content: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ taskId: z.uuid(), content: z.string().trim().min(1).max(3000) }).safeParse(input)
    if (!d.success) return fail('Le commentaire est vide ou trop long.')
    const task = await prisma.task.findUnique({ where: { id: d.data.taskId }, include: { assignees: true } })
    if (!task) return fail('Tâche introuvable.')
    await prisma.taskComment.create({ data: { taskId: task.id, authorId: user.id, content: d.data.content } })
    await notify([task.createdById, ...task.assignees.map((a) => a.userId)], 'task_comment', `${user.name} a commenté « ${task.title} »`, task.id, user.id)
    refresh(task.id)
    return ok(null)
  }, 'Le commentaire n’a pas pu être envoyé.')
}
