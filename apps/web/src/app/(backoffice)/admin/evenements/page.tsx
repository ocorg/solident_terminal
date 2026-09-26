import Link from 'next/link'
import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { registrationState } from '@/lib/registrations'

const typeLabel: Record<string, string> = { solifun: 'Solifun', caravane: 'Caravane', scientifique: 'Scientifique', ambassadeurs: 'Jeunes ambassadeurs', autre: 'Autre' }
const when = (d: Date) => d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

export default async function AdminEventsPage() {
  const { role } = await requireRolePage('admin', 'media', 'hr')
  const events = await prisma.event.findMany({
    orderBy: { startsAt: 'desc' },
    include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
  })
  const canEdit = role === 'admin' || role === 'media'
  const now = new Date()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Événements</h1>
        {canEdit && (
          <Link href="/admin/evenements/nouveau" className="btn btn-primary">
            + Nouvel événement
          </Link>
        )}
      </div>
      {events.length === 0 && <p className="card p-6 text-ink-600">Aucun événement.</p>}
      <ul className="card divide-y divide-navy-100">
        {events.map((e) => {
          const s = registrationState(e, e._count.registrations)
          const past = (e.endsAt ?? e.startsAt) < now
          return (
            <li key={e.id} className={`flex flex-wrap items-center gap-4 p-4 ${past ? 'opacity-70' : ''}`}>
              <div className="min-w-56 flex-1">
                <p className="font-semibold">
                  {e.titleFr}
                  <span className="ms-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-700">{typeLabel[e.type]}</span>
                  {!e.isPublished && <span className="ms-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs text-navy-900">brouillon</span>}
                </p>
                <p className="text-xs text-ink-600">
                  {when(e.startsAt)}
                  {e.location && ` · ${e.location}`}
                </p>
              </div>
              <p className="text-sm text-ink-600">
                {e._count.registrations}
                {e.capacity ? ` / ${e.capacity}` : ''} inscrits ·{' '}
                <span className={s.open ? 'font-semibold text-success' : ''}>{s.open ? 'ouvert' : s.placesLeft === 0 ? 'complet' : 'fermé'}</span>
              </p>
              <div className="flex gap-2">
                <Link href={`/admin/inscriptions?evenement=${e.id}`} className="btn btn-ghost px-3 py-1.5 text-sm">
                  Inscrits
                </Link>
                {canEdit && (
                  <Link href={`/admin/evenements/${e.id}`} className="btn btn-ghost px-3 py-1.5 text-sm">
                    Modifier
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
