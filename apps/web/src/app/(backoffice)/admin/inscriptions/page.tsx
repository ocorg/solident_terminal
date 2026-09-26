import Link from 'next/link'
import { prisma, type RegistrationStatus as Status } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { RegistrationStatus } from './status-select'

const profileLabel = { etudiant: 'Étudiant·e', praticien: 'Praticien·ne', public: 'Public' }
const statusTabs: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'new', label: 'Nouvelles' },
  { key: 'processed', label: 'Traitées' },
  { key: 'cancelled', label: 'Annulées' },
]
const date = (d: Date) => d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

export default async function InscriptionsPage({ searchParams }: PageProps<'/admin/inscriptions'>) {
  await requireRolePage('admin', 'hr')
  const sp = await searchParams
  const events = await prisma.event.findMany({
    where: { registrations: { some: {} } },
    orderBy: { startsAt: 'desc' },
    select: { id: true, titleFr: true, startsAt: true, capacity: true, _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
  })
  const eventId = events.find((e) => e.id === sp.evenement)?.id ?? events[0]?.id
  const status = statusTabs.find((t) => t.key === sp.statut)?.key ?? 'all'
  const event = events.find((e) => e.id === eventId)

  const registrations = eventId
    ? await prisma.registration.findMany({
        where: { eventId, ...(status !== 'all' && { status }) },
        orderBy: { createdAt: 'asc' },
      })
    : []
  const href = (q: Record<string, string>) => `/admin/inscriptions?${new URLSearchParams({ ...(eventId && { evenement: eventId }), statut: status, ...q })}`

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Inscriptions</h1>
      {events.length === 0 ? (
        <p className="card p-6 text-ink-600">Aucune inscription pour l’instant. Elles apparaîtront ici dès qu’un événement aura des inscrits.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/admin/inscriptions?evenement=${e.id}`}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${e.id === eventId ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 hover:bg-navy-100'}`}
              >
                {e.titleFr} <span className="opacity-70">({e._count.registrations}{e.capacity ? `/${e.capacity}` : ''})</span>
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((t) => (
                <Link key={t.key} href={href({ statut: t.key })} className={`rounded-full px-3 py-1 text-sm ${status === t.key ? 'bg-gold-500 font-semibold text-navy-900' : 'bg-white text-navy-700'}`}>
                  {t.label}
                </Link>
              ))}
            </div>
            {eventId && (
              <a href={`/admin/inscriptions/export?evenement=${eventId}`} className="btn btn-primary px-4 py-2 text-sm">
                Exporter en CSV (Excel)
              </a>
            )}
          </div>

          {registrations.length === 0 ? (
            <p className="card p-6 text-ink-600">Aucune inscription dans cette liste.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="stack-table w-full min-w-[820px] text-sm">
                <thead className="bg-navy-100 text-navy-900">
                  <tr>
                    {['#', 'Nom', 'Téléphone', 'E-mail', 'Ville', 'Profil', 'Remarque', 'Inscrit le', 'Statut'].map((h) => (
                      <th key={h} className="px-3 py-3 text-start font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, i) => (
                    <tr key={r.id} className={`border-t border-navy-100 align-top ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2 text-ink-600 max-md:!hidden">{i + 1}</td>
                      <td className="stack-full px-3 py-2 font-semibold">{r.fullName}</td>
                      <td data-label="Téléphone" className="px-3 py-2">
                        <a href={`tel:${r.phone}`} dir="ltr" className="text-navy-700 underline">
                          {r.phone}
                        </a>{' '}
                        <a href={`https://wa.me/${r.phone.replace('+', '')}`} target="_blank" rel="noreferrer" className="text-xs text-success underline">
                          WhatsApp
                        </a>
                      </td>
                      <td data-label="E-mail" className="px-3 py-2 text-ink-600">{r.email ?? '—'}</td>
                      <td data-label="Ville" className="px-3 py-2 text-ink-600">{r.city ?? '—'}</td>
                      <td data-label="Profil" className="px-3 py-2">{profileLabel[r.profile]}</td>
                      <td data-label="Remarque" className="px-3 py-2 text-ink-600 md:max-w-56">{r.note ?? ''}</td>
                      <td data-label="Inscrit le" className="whitespace-nowrap px-3 py-2 text-ink-600">{date(r.createdAt)}</td>
                      <td data-label="Statut" className="px-3 py-2">
                        <RegistrationStatus id={r.id} status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {event && <p className="text-xs text-ink-600">Annuler une inscription libère sa place et met à jour le compteur en direct sur le site.</p>}
        </>
      )}
    </div>
  )
}
