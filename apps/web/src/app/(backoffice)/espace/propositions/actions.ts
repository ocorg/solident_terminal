'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { notify, requireMember } from '@/lib/space'

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  isActivity: z.boolean(),
  parentProjectId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
  suggestedChefId: z.union([z.literal(''), z.uuid()]).optional().transform((v) => v || null),
})

export async function submitProposal(input: z.input<typeof schema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('Donnez un titre d’au moins 3 caractères.')
    const d = parsed.data
    if (d.isActivity && !d.parentProjectId) return fail('Une activité doit être rattachée à un projet.')
    const p = await prisma.projectProposal.create({ data: { ...d, type: d.isActivity ? 'Activité' : 'Projet', proposedById: user.id } })
    const admins = await prisma.user.findMany({ where: { isActive: true, OR: [{ role: 'admin' }, { spaceAdmin: true }] }, select: { id: true } })
    await notify(admins.map((a) => a.id), 'proposal_submitted', `${user.name} propose : « ${p.title} »`, p.id, user.id)
    revalidatePath('/espace', 'layout')
    return ok({ id: p.id })
  }, 'L’envoi a échoué.')
}

/** Approve → creates the project (Chef de Projet + Membre positions, suggested chef assigned). */
export async function reviewProposal(input: { id: string; decision: string; notes?: string }) {
  return run(async () => {
    const user = await requireMember()
    if (!user.isSpaceAdmin) return fail('Décision réservée aux administrateurs de l’espace.')
    const d = z.object({ id: z.uuid(), decision: z.enum(['approuve', 'rejete']), notes: z.string().trim().max(2000).optional() }).parse(input)
    const p = await prisma.projectProposal.findUnique({ where: { id: d.id } })
    if (!p) return fail('Proposition introuvable.')
    if (p.status !== 'en_attente') return fail('Cette proposition a déjà été traitée.')

    let projectId: string | null = null
    await prisma.$transaction(async (tx) => {
      await tx.projectProposal.update({ where: { id: p.id }, data: { status: d.decision, reviewNotes: d.notes || null, reviewedById: user.id, reviewedAt: new Date() } })
      if (d.decision === 'approuve') {
        const project = await tx.project.create({
          data: { name: p.title, description: p.description, parentProjectId: p.parentProjectId, proposedById: p.proposedById, approvalStatus: 'approuve', status: 'actif' },
        })
        projectId = project.id
        const chef = await tx.projectPosition.create({ data: { projectId: project.id, name: 'Chef de Projet' } })
        await tx.projectPosition.create({ data: { projectId: project.id, name: 'Membre' } })
        if (p.suggestedChefId) await tx.projectMember.create({ data: { projectId: project.id, userId: p.suggestedChefId, positionId: chef.id } })
      }
      await tx.auditLog.create({ data: { userId: user.id, action: `proposal.${d.decision}`, entity: 'project_proposal', entityId: p.id, payload: { projectId } } })
    })
    await notify(
      [p.proposedById],
      d.decision === 'approuve' ? 'proposal_approved' : 'proposal_rejected',
      d.decision === 'approuve' ? `Votre proposition « ${p.title} » est approuvée 🎉` : `Votre proposition « ${p.title} » n’a pas été retenue${d.notes ? ` : ${d.notes}` : ''}`,
      projectId ?? p.id,
      user.id,
    )
    if (projectId && p.suggestedChefId && p.suggestedChefId !== p.proposedById) await notify([p.suggestedChefId], 'project_member_added', `Vous êtes Chef de Projet de « ${p.title} »`, projectId, user.id)
    revalidatePath('/espace', 'layout')
    return ok({ projectId })
  }, 'La décision n’a pas pu être enregistrée.')
}

export async function withdrawProposal(input: { id: string }) {
  return run(async () => {
    const user = await requireMember()
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const p = await prisma.projectProposal.findUnique({ where: { id } })
    if (!p || p.proposedById !== user.id || p.status !== 'en_attente') return fail('Seule une proposition en attente que vous avez faite peut être retirée.')
    await prisma.projectProposal.delete({ where: { id } })
    revalidatePath('/espace', 'layout')
    return ok(null)
  }, 'Le retrait a échoué.')
}
