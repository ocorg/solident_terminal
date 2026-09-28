import 'server-only'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { prisma, type ContextType } from '@solident/db'
import { getSession } from './guards'
import { notificationLink } from './notification-links'
import { sendPush } from './push'
import { isManagementPosition } from './space-labels'

// Members area (ex-Terminal) access rules:
// - any active account can enter;
// - "space admins" (Terminal admins + website admins) can manage everything in the area;
// - project/cellule managers (non-"membre" position) manage their context and its tasks;
// - task assignees can update their tasks' status and comment.

export type SpaceUser = { id: string; name: string; email: string; image: string | null; role: string; isSpaceAdmin: boolean }

async function loadUser() {
  const session = await getSession()
  if (!session?.user.isActive) return null
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, image: true, role: true, spaceAdmin: true, isActive: true } })
  if (!u?.isActive) return null
  return { id: u.id, name: u.name, email: u.email, image: u.image, role: u.role, isSpaceAdmin: u.role === 'admin' || u.spaceAdmin } satisfies SpaceUser
}

/** For pages: logged-in active member, else to /connexion. */
export async function requireMemberPage(): Promise<SpaceUser> {
  const u = await loadUser()
  if (!u) redirect('/connexion')
  return u
}

/** For server actions: throws instead of redirecting. */
export async function requireMember(): Promise<SpaceUser> {
  const u = await loadUser()
  if (!u) throw new Error('Non connecté')
  return u
}

export async function isContextManager(user: SpaceUser, type: ContextType, id: string) {
  if (user.isSpaceAdmin) return true
  const m =
    type === 'project'
      ? await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: id, userId: user.id } }, include: { position: true } })
      : await prisma.celluleMember.findUnique({ where: { celluleId_userId: { celluleId: id, userId: user.id } }, include: { position: true } })
  return !!m && isManagementPosition(m.position.name)
}

/** Manager of the task's main or secondary contexts → full edit; assignee → status + comments. */
export async function taskRights(user: SpaceUser, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { contexts: true, assignees: { select: { userId: true } } } })
  if (!task) return { task: null, isManager: false, isAssignee: false }
  const isAssignee = task.assignees.some((a) => a.userId === user.id)
  let isManager = user.isSpaceAdmin || task.createdById === user.id
  for (const c of [{ contextType: task.contextType, contextId: task.contextId }, ...task.contexts]) {
    if (isManager) break
    isManager = await isContextManager(user, c.contextType, c.contextId)
  }
  return { task, isManager, isAssignee }
}

/** Names of projects and cellules, to label task contexts. */
export async function contextNames() {
  const [projects, cellules] = await Promise.all([
    prisma.project.findMany({ select: { id: true, name: true } }),
    prisma.cellule.findMany({ select: { id: true, name: true } }),
  ])
  return new Map<string, string>([...projects.map((p) => [p.id, p.name] as const), ...cellules.map((c) => [c.id, c.name] as const)])
}

/** In-app notification (+ e-mail digest entry when the member accepts e-mails). */
export async function notify(recipientIds: string[], type: string, message: string, targetId?: string, exceptUserId?: string) {
  const ids = [...new Set(recipientIds)].filter((id) => id !== exceptUserId)
  if (!ids.length) return
  await prisma.notification.createMany({ data: ids.map((recipientId) => ({ recipientId, type, message, targetId })) })
  const wantsMail = await prisma.user.findMany({ where: { id: { in: ids }, emailNotifications: true, isActive: true }, select: { id: true } })
  if (wantsMail.length)
    await prisma.emailQueueItem.createMany({
      data: wantsMail.map((u) => ({ recipientId: u.id, actionType: type, payload: { message, targetId: targetId ?? null }, sendAfter: new Date(Date.now() + 15 * 60_000) })),
    })
  // Phone notifications go out after the response, so a slow push service never delays the action.
  after(() => sendPush(ids, { title: pushTitle(type), body: message, url: notificationLink(type, targetId) ?? '/espace/notifications', tag: targetId }))
}

function pushTitle(type: string) {
  if (type === 'task_assigned') return 'Nouvelle tâche'
  if (type === 'task_comment') return 'Nouveau commentaire'
  if (type.startsWith('task_')) return 'Tâche mise à jour'
  if (type === 'event_invited') return 'Invitation'
  if (type.startsWith('proposal_')) return 'Proposition de projet'
  return 'Solident'
}
