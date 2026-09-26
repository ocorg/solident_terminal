'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { notify, requireMember } from '@/lib/space'
import { localInputToDate } from '@/lib/tz'

const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
const schema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).optional().transform((v) => v || null),
  type: z.enum(['activite', 'action', 'reunion', 'evenement']),
  contextRef: z.string().optional(), // "project:<id>" | "cellule:<id>" | ""
  startAt: dt,
  endAt: z.union([z.literal(''), dt]).optional(),
  location: z.string().trim().max(160).optional().transform((v) => v || null),
  visibility: z.enum(['tous', 'invites']),
  inviteContexts: z.array(z.string()).max(20), // "project:<id>" | "cellule:<id>"
  inviteUserIds: z.array(z.uuid()).max(200),
})
export type TeamEventInput = z.input<typeof schema>

const parseRef = (ref?: string) => {
  const m = ref?.match(/^(project|cellule):([0-9a-f-]{36})$/)
  return m ? { contextType: m[1] as 'project' | 'cellule', contextId: m[2] } : null
}

/** People to invite = chosen individuals + members of chosen projects/cellules. */
async function inviteeIds(contexts: { contextType: 'project' | 'cellule'; contextId: string }[], userIds: string[]) {
  const ids = new Set(userIds)
  for (const c of contexts) {
    const members =
      c.contextType === 'project'
        ? await prisma.projectMember.findMany({ where: { projectId: c.contextId }, select: { userId: true } })
        : await prisma.celluleMember.findMany({ where: { celluleId: c.contextId }, select: { userId: true } })
    members.forEach((m) => ids.add(m.userId))
  }
  return [...ids]
}

export async function saveTeamEvent(input: TeamEventInput) {
  return run(async () => {
    const user = await requireMember()
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('Vérifiez le titre et les dates.')
    const d = parsed.data
    const startAt = localInputToDate(d.startAt)
    const endAt = d.endAt ? localInputToDate(d.endAt) : null
    if (endAt && endAt < startAt) return fail('La fin doit être après le début.')
    if (d.id) {
      const existing = await prisma.teamEvent.findUnique({ where: { id: d.id } })
      if (!existing) return fail('Événement introuvable.')
      if (existing.createdById !== user.id && !user.isSpaceAdmin) return fail('Seul·e l’auteur·e ou un administrateur peut modifier cet événement.')
    }
    const ctx = parseRef(d.contextRef)
    const invContexts = d.inviteContexts.map(parseRef).filter((x): x is NonNullable<typeof x> => !!x)
    const data = {
      title: d.title, description: d.description, type: d.type, startAt, endAt, location: d.location, visibility: d.visibility,
      contextType: ctx?.contextType ?? ('global' as const), contextId: ctx?.contextId ?? null,
    }
    const event = d.id ? await prisma.teamEvent.update({ where: { id: d.id }, data }) : await prisma.teamEvent.create({ data: { ...data, createdById: user.id } })

    const people = await inviteeIds(invContexts, d.inviteUserIds)
    const already = new Set((await prisma.teamEventAttendee.findMany({ where: { eventId: event.id }, select: { userId: true } })).map((a) => a.userId))
    const fresh = people.filter((id) => !already.has(id))
    await prisma.$transaction([
      prisma.teamEventInvite.createMany({ data: invContexts.map((c) => ({ eventId: event.id, ...c })), skipDuplicates: true }),
      prisma.teamEventAttendee.createMany({ data: fresh.map((userId) => ({ eventId: event.id, userId })), skipDuplicates: true }),
    ])
    const when = startAt.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })
    await notify(fresh, 'event_invited', `${user.name} vous invite : « ${event.title} », ${when}`, event.id, user.id)
    revalidatePath('/espace', 'layout')
    return ok({ id: event.id })
  }, 'L’enregistrement a échoué.')
}

export async function deleteTeamEvent(input: { id: string }) {
  return run(async () => {
    const user = await requireMember()
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const e = await prisma.teamEvent.findUnique({ where: { id } })
    if (!e) return fail('Événement introuvable.')
    if (e.createdById !== user.id && !user.isSpaceAdmin) return fail('Seul·e l’auteur·e ou un administrateur peut supprimer cet événement.')
    await prisma.teamEvent.delete({ where: { id } })
    revalidatePath('/espace', 'layout')
    return ok(null)
  }, 'La suppression a échoué.')
}

export async function setRsvp(input: { eventId: string; rsvp: string }) {
  return run(async () => {
    const user = await requireMember()
    const d = z.object({ eventId: z.uuid(), rsvp: z.enum(['oui', 'non', 'en_attente']) }).parse(input)
    const e = await prisma.teamEvent.findUnique({ where: { id: d.eventId }, include: { attendees: { where: { userId: user.id } } } })
    if (!e) return fail('Événement introuvable.')
    if (e.visibility === 'invites' && !e.attendees.length && e.createdById !== user.id) return fail('Cet événement est réservé aux invité·e·s.')
    await prisma.teamEventAttendee.upsert({ where: { eventId_userId: { eventId: e.id, userId: user.id } }, create: { eventId: e.id, userId: user.id, rsvp: d.rsvp }, update: { rsvp: d.rsvp } })
    revalidatePath('/espace', 'layout')
    return ok(null)
  }, 'La réponse n’a pas pu être enregistrée.')
}
