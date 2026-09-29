import Link from 'next/link'
import { prisma, type VolunteerStatus as Status } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { VolunteerStatus } from './status-select'

const tabs: { key: Status | 'all'; label: string }[] = [
  { key: 'new', label: 'Nouvelles' },
  { key: 'contacted', label: 'Contactés' },
  { key: 'accepted', label: 'Acceptés' },
  { key: 'declined', label: 'Déclinées' },
  { key: 'all', label: 'Toutes' },
]
const profileLabel = { etudiant: 'Étudiant·e', praticien: 'Praticien·ne', public: 'Autre métier' }
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Casablanca' })

export default async function BenevolesPage({ searchParams }: PageProps<'/admin/benevoles'>) {
  await requireRolePage('admin', 'hr')
  const { statut } = await searchParams
  const current = tabs.find((t) => t.key === statut)?.key ?? 'new'
  const [apps, counts] = await Promise.all([
    prisma.volunteerApplication.findMany({ where: current === 'all' ? {} : { status: current }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.volunteerApplication.groupBy({ by: ['status'], _count: true }),
  ])
  const count = (k: string) => (k === 'all' ? counts.reduce((s, c) => s + c._count, 0) : (counts.find((c) => c.status === k)?._count ?? 0))

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Bénévoles</h1>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/benevoles?statut=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${current === t.key ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 hover:bg-navy-100'}`}
          >
            {t.label} <span className="font-normal">({count(t.key)})</span>
          </Link>
        ))}
      </div>
      {apps.length === 0 && <p className="card p-6 text-ink-600">Aucune candidature dans cette liste.</p>}
      <ul className="space-y-3">
        {apps.map((a) => (
          <li key={a.id} className="card p-5">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {a.fullName} <span className="ms-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-700">{a.profile ? profileLabel[a.profile] : '—'}</span>
                </p>
                <p className="text-sm text-ink-600">
                  <a href={`tel:${a.phone}`} dir="ltr" className="text-navy-700 underline">
                    {a.phone}
                  </a>{' '}
                  ·{' '}
                  <a href={`https://wa.me/${a.phone.replace('+', '')}`} target="_blank" rel="noreferrer" className="text-success underline">
                    WhatsApp
                  </a>
                  {a.email && (
                    <>
                      {' · '}
                      <a href={`mailto:${a.email}`} className="text-navy-700 underline">
                        {a.email}
                      </a>
                    </>
                  )}
                  {a.city && ` · ${a.city}`} · {day(a.createdAt)}
                </p>
              </div>
              <VolunteerStatus id={a.id} status={a.status} />
            </div>
            <dl className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
              {a.skills && (
                <div>
                  <dt className="font-semibold text-navy-900">Compétences</dt>
                  <dd>{a.skills}</dd>
                </div>
              )}
              {a.availability && (
                <div>
                  <dt className="font-semibold text-navy-900">Disponibilités</dt>
                  <dd>{a.availability}</dd>
                </div>
              )}
            </dl>
            {a.motivation && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">{a.motivation}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
