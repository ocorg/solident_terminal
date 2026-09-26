import 'server-only'
import { prisma } from '@solident/db'
import type { SpaceUser } from '@/lib/space'

/** Projects + cellules (with member ids) and people, for task forms. Non-admins only see contexts they belong to. */
export async function taskFormData(user: SpaceUser) {
  const [projects, cellules, people] = await Promise.all([
    prisma.project.findMany({ where: { approvalStatus: 'approuve' }, orderBy: { name: 'asc' }, select: { id: true, name: true, members: { select: { userId: true } } } }),
    prisma.cellule.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, members: { select: { userId: true } } } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const contexts = [
    ...projects.map((p) => ({ type: 'project' as const, id: p.id, name: p.name, memberIds: p.members.map((m) => m.userId) })),
    ...cellules.map((c) => ({ type: 'cellule' as const, id: c.id, name: c.name, memberIds: c.members.map((m) => m.userId) })),
  ].filter((c) => user.isSpaceAdmin || c.memberIds.includes(user.id))
  return { contexts, people }
}
