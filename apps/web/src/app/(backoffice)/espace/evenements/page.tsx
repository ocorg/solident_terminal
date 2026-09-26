import Link from 'next/link'
import { prisma, type Prisma } from '@solident/db'
import { AvatarStack } from '@/components/space/avatar'
import { contextNames, requireMemberPage } from '@/lib/space'
import { teamEventTypeLabel } from '@/lib/space-labels'
import { dateToLocalInput } from '@/lib/tz'
import { DeleteTeamEvent, RsvpButtons, TeamEventFormToggle } from './event-widgets'

export const metadata = { title: 'Agenda' }
const fmt = (d: Date, withYear = false) =>
  d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(withYear && { year: 'numeric' }), hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

export default async function AgendaPage({ searchParams }: PageProps<'/espace/evenements'>) {
  const user = await requireMemberPage()
  const past = (await searchParams).passes === '1'
  const now = new Date()
  const visible: Prisma.TeamEventWhereInput = user.isSpaceAdmin ? {} : { OR: [{ visibility: 'tous' }, { createdById: user.id }, { attendees: { some: { userId: user.id } } }] }
  const [events, names, projects, cellules, people] = await Promise.all([
    prisma.teamEvent.findMany({
      where: { ...visible, ...(past ? { startAt: { lt: now } } : { OR: [{ startAt: { gte: now } }, { endAt: { gte: now } }] }) },
      orderBy: { startAt: past ? 'desc' : 'asc' },
      take: 100,
      include: { createdBy: { select: { name: true } }, attendees: { include: { user: { select: { id: true, name: true, image: true } } } }, invites: true },
    }),
    contextNames(),
    prisma.project.findMany({ where: { approvalStatus: 'approuve' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.cellule.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const contexts = [...projects.map((p) => ({ ref: `project:${p.id}`, name: `Projet · ${p.name}` })), ...cellules.map((c) => ({ ref: `cellule:${c.id}`, name: `Cellule · ${c.name}` }))]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Agenda</h1>
        <TeamEventFormToggle label="+ Nouvel événement" contexts={contexts} people={people} />
      </div>
      <div className="flex gap-2">
        <Link href="/espace/evenements" className={`rounded-full px-3 py-1 text-sm font-semibold ${!past ? 'bg-navy-700 text-white' : 'bg-white text-navy-700'}`}>
          À venir
        </Link>
        <Link href="/espace/evenements?passes=1" className={`rounded-full px-3 py-1 text-sm font-semibold ${past ? 'bg-navy-700 text-white' : 'bg-white text-navy-700'}`}>
          Passés
        </Link>
      </div>
      {events.length === 0 && <p className="card p-6 text-ink-600">{past ? 'Aucun événement passé.' : 'Rien de prévu. Créez la prochaine réunion !'}</p>}
      <ul className="space-y-3">
        {events.map((e) => {
          const mine = e.attendees.find((a) => a.userId === user.id)
          const yes = e.attendees.filter((a) => a.rsvp === 'oui')
          const canEdit = e.createdById === user.id || user.isSpaceAdmin
          return (
            <li key={e.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gold-500">
                    {fmt(e.startAt, past)}
                    {e.endAt && ` → ${e.endAt.toDateString() === e.startAt.toDateString() ? e.endAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }) : fmt(e.endAt)}`}
                  </p>
                  <p className="font-heading text-lg font-bold text-navy-900">{e.title}</p>
                  <p className="text-xs text-ink-600">
                    {teamEventTypeLabel[e.type]}
                    {e.contextId && ` · ${names.get(e.contextId) ?? ''}`}
                    {e.location && ` · ${e.location}`}
                    {e.visibility === 'invites' && ' · 🔒 invités seulement'} · par {e.createdBy.name}
                  </p>
                </div>
                {!past && <RsvpButtons eventId={e.id} current={mine?.rsvp ?? null} />}
              </div>
              {e.description && <p className="whitespace-pre-wrap text-sm text-ink-600">{e.description}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-600">
                <span className="flex items-center gap-2">
                  <AvatarStack people={yes.map((a) => a.user)} max={8} />
                  {yes.length} participant{yes.length > 1 ? 's' : ''} · {e.attendees.length} invité{e.attendees.length > 1 ? 's' : ''}
                </span>
                {canEdit && (
                  <span className="flex items-center gap-4">
                    <TeamEventFormToggle
                      label="Modifier"
                      contexts={contexts}
                      people={people}
                      initial={{
                        id: e.id,
                        title: e.title,
                        description: e.description ?? '',
                        type: e.type,
                        contextRef: e.contextId ? `${e.contextType}:${e.contextId}` : '',
                        startAt: dateToLocalInput(e.startAt),
                        endAt: e.endAt ? dateToLocalInput(e.endAt) : '',
                        location: e.location ?? '',
                        visibility: e.visibility,
                        inviteContexts: e.invites.map((i) => `${i.contextType}:${i.contextId}`),
                        inviteUserIds: [],
                      }}
                    />
                    <DeleteTeamEvent id={e.id} title={e.title} />
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
