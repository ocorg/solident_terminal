import Link from 'next/link'
import { prisma, type InquiryKind } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { StatusSelect } from './status-select'

const tabs: { key: InquiryKind | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'contact', label: 'Contact' },
  { key: 'sponsor', label: 'Sponsoring' },
]
const date = (d: Date) => d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

export default async function MessagesPage({ searchParams }: PageProps<'/admin/messages'>) {
  await requireRolePage('admin')
  const { type } = await searchParams
  const current = tabs.find((t) => t.key === type)?.key ?? 'all'

  const inquiries = await prisma.inquiry.findMany({
    where: current === 'all' ? {} : { kind: current },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: { tier: { select: { name: true } } },
  })

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Messages</h1>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/messages?type=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${current === t.key ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 hover:bg-navy-100'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {inquiries.length === 0 && <p className="card p-6 text-ink-600">Aucun message.</p>}
      <ul className="space-y-3">
        {inquiries.map((q) => (
          <li key={q.id} className={`card p-5 ${q.status === 'closed' ? 'opacity-85' : ''}`}>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {[q.organisation, q.fullName].filter(Boolean).join(' · ') || q.email}
                  <span className={`ms-2 rounded-full px-2 py-0.5 text-xs font-semibold ${q.kind === 'sponsor' ? 'bg-gold-100 text-navy-900' : 'bg-navy-100 text-navy-700'}`}>
                    {q.kind === 'sponsor' ? `Sponsoring${q.tier ? ` · ${q.tier.name}` : ''}` : 'Contact'}
                  </span>
                </p>
                <p className="text-sm text-ink-600">
                  <a href={`mailto:${q.email}`} className="text-navy-700 underline">
                    {q.email}
                  </a>
                  {q.phone && (
                    <>
                      {' · '}
                      <a href={`tel:${q.phone}`} dir="ltr" className="text-navy-700 underline">
                        {q.phone}
                      </a>
                    </>
                  )}
                  {' · '}
                  {date(q.createdAt)}
                </p>
              </div>
              <StatusSelect id={q.id} status={q.status} />
            </div>
            {q.message && <p className="whitespace-pre-wrap text-sm text-ink-600">{q.message}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
