import Link from 'next/link'
import { prisma } from '@solident/db'
import { BrushRing, ProgressRing } from '@/components/motion/brush-ring'
import { CountUp } from '@/components/motion/count-up'
import { contextNames, requireMemberPage } from '@/lib/space'
import { priorityRank, taskPriorityLabel, taskStatusLabel, taskStatusStyle, teamEventTypeLabel } from '@/lib/space-labels'

const when = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Casablanca' })

export default async function SpaceDashboard() {
  const user = await requireMemberPage()
  const now = new Date()
  const [myTasks, events, projects, cellules, names, stats] = await Promise.all([
    prisma.task.findMany({ where: { archived: false, status: { not: 'termine' }, assignees: { some: { userId: user.id } } }, take: 50 }),
    prisma.teamEvent.findMany({
      where: {
        startAt: { gte: new Date(now.getTime() - 3 * 3600_000) },
        OR: [{ visibility: 'tous' }, { attendees: { some: { userId: user.id } } }, { createdById: user.id }],
      },
      orderBy: { startAt: 'asc' },
      take: 5,
      include: { attendees: { where: { userId: user.id } } },
    }),
    prisma.projectMember.findMany({ where: { userId: user.id }, include: { project: true, position: true } }),
    prisma.celluleMember.findMany({ where: { userId: user.id }, include: { cellule: true, position: true } }),
    contextNames(),
    prisma.task.groupBy({ by: ['status'], where: { archived: false }, _count: true }),
  ])
  myTasks.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0
  const firstName = user.name.split(' ')[0]

  // Greeting follows the time of day in Morocco
  const hour = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Africa/Casablanca' }))
  const greeting = hour < 5 || hour >= 18 ? 'Bonsoir' : hour < 12 ? 'Bonjour' : 'Bon après-midi'
  const today = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Casablanca' })
  const total = count('a_faire') + count('en_cours') + count('bloque') + count('termine')
  const donePct = total ? Math.round((count('termine') / total) * 100) : 0

  const tiles: { label: string; value: number; href: string; alert?: boolean }[] = [
    { label: 'Mes tâches ouvertes', value: myTasks.length, href: '/espace/taches?vue=moi' },
    { label: 'En cours (équipe)', value: count('en_cours'), href: '/espace/taches?statut=en_cours' },
    { label: 'Bloquées (équipe)', value: count('bloque'), href: '/espace/taches?statut=bloque', alert: count('bloque') > 0 },
    { label: 'Terminées (équipe)', value: count('termine'), href: '/espace/taches?statut=termine' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome band */}
      <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white sm:p-8">
        <BrushRing className="pointer-events-none absolute -end-20 -top-24 size-72 opacity-20" strokeWidth={10} />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-sm first-letter:uppercase text-white/75">{today}</p>
            <h1 className="mt-1 font-heading text-3xl font-bold">
              {greeting} {firstName}
              <span className="brand-dot" aria-hidden />
            </h1>
            <p className="mt-2 text-white/80">« Chacun fait ce qu’il peut. Chacun dit clairement ce qu’il peut faire. »</p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-4">
              <div className="relative">
                <ProgressRing value={donePct / 100} label={`${donePct} % des tâches de l’équipe terminées`} />
                <p className="absolute inset-0 flex items-center justify-center font-heading text-lg font-bold" aria-hidden>
                  {donePct}%
                </p>
              </div>
              <p className="max-w-32 text-sm text-white/80">des tâches de l’équipe terminées</p>
            </div>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((s) => (
          <li key={s.label} data-reveal>
            <Link href={s.href} className={`card card-hover flex h-full flex-col p-5 ${s.alert ? 'border-s-4 border-danger' : ''}`}>
              <CountUp value={s.value} className={`font-heading text-3xl font-bold ${s.alert ? 'text-danger' : 'text-navy-700'}`} />
              <span className="text-sm text-ink-600">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-navy-700">Mes tâches</h2>
            <Link href="/espace/taches?vue=moi" className="nudge text-sm font-semibold text-navy-700 hover:underline">
              Tout voir <span className="nudge-arrow inline-block">→</span>
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="card flex items-center gap-3 p-5 text-ink-600">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 font-bold text-success" aria-hidden>
                ✓
              </span>
              Aucune tâche ouverte qui vous est assignée. Profitez-en pour donner un coup de main à un projet.
            </p>
          ) : (
            <ul className="card divide-y divide-navy-100">
              {myTasks.slice(0, 8).map((t) => {
                const late = t.dueDate && t.dueDate < now
                return (
                  <li key={t.id}>
                    <Link href={`/espace/taches/${t.id}`} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-cream-50">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${taskStatusStyle[t.status]}`}>{taskStatusLabel[t.status]}</span>
                      <span className="min-w-40 flex-1 font-semibold">{t.title}</span>
                      <span className="text-xs text-ink-600">{names.get(t.contextId) ?? ''}</span>
                      <span className="text-xs">{taskPriorityLabel[t.priority]}</span>
                      {t.dueDate && (
                        <span className={`text-xs ${late ? 'font-bold text-danger' : 'text-ink-600'}`}>
                          {late ? 'En retard · ' : ''}
                          {day(t.dueDate)}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-navy-700">Agenda</h2>
            <Link href="/espace/evenements" className="nudge text-sm font-semibold text-navy-700 hover:underline">
              Tout voir <span className="nudge-arrow inline-block">→</span>
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="card p-5 text-ink-600">Rien de prévu pour l’instant. Une réunion à caler ? Créez-la dans l’agenda.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="card border-s-4 border-gold-500 p-4" data-reveal>
                  <p className="text-xs font-semibold text-gold-700">{when(e.startAt)}</p>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-ink-600">
                    {teamEventTypeLabel[e.type]}
                    {e.location && ` · ${e.location}`}
                    {e.attendees[0] && ` · Réponse : ${e.attendees[0].rsvp === 'oui' ? 'Oui' : e.attendees[0].rsvp === 'non' ? 'Non' : 'à donner'}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-navy-700">Mes projets et cellules</h2>
        {projects.length + cellules.length === 0 ? (
          <p className="card p-5 text-ink-600">
            Vous ne faites encore partie d’aucun projet ni d’aucune cellule.{' '}
            <Link href="/espace/projets" className="font-semibold text-navy-700 underline">
              Découvrir les projets
            </Link>
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((m) => (
              <li key={m.id} data-reveal>
                <Link href={`/espace/projets/${m.projectId}`} className="card card-hover block h-full p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">Projet</p>
                  <p className="font-semibold">{m.project.name}</p>
                  <p className="text-xs text-ink-600">{m.position.name}</p>
                </Link>
              </li>
            ))}
            {cellules.map((m) => (
              <li key={m.id} data-reveal>
                <Link href={`/espace/cellules/${m.celluleId}`} className="card card-hover block h-full p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">Cellule</p>
                  <p className="font-semibold">{m.cellule.name}</p>
                  <p className="text-xs text-ink-600">{m.position.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
