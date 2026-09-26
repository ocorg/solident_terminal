import Link from 'next/link'
import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'

const dh = (n: number) => new Intl.NumberFormat('fr-MA').format(n) + ' DH'
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function CampagnesPage() {
  await requireRolePage('admin', 'treasurer')
  const campaigns = await prisma.campaign.findMany({
    orderBy: [{ isActive: 'desc' }, { startsOn: 'desc' }],
    include: { _count: { select: { donations: { where: { status: 'pending' } } } } },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Campagnes</h1>
        <Link href="/admin/campagnes/nouvelle" className="btn btn-primary">
          + Nouvelle campagne
        </Link>
      </div>
      {campaigns.length === 0 && <p className="card p-6 text-ink-600">Aucune campagne.</p>}
      <div className="grid gap-4">
        {campaigns.map((c) => {
          const pct = c.goalDh ? Math.min(100, Math.round((c.raisedDh / c.goalDh) * 100)) : 0
          return (
            <Link key={c.id} href={`/admin/campagnes/${c.id}`} className="card card-hover block p-5">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {c.titleFr}{' '}
                    <span className={`ms-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.isActive ? 'bg-success/15 text-success' : 'bg-navy-100 text-ink-600'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                  <p className="text-xs text-ink-600">
                    {day(c.startsOn)}
                    {c.endsOn && ` → ${day(c.endsOn)}`} · /{c.slug}
                    {(!c.titleAr || !c.titleEn) && ' · traductions manquantes'}
                  </p>
                </div>
                <p className="text-sm text-ink-600">
                  {dh(c.raisedDh)} / {dh(c.goalDh)} · {c.donorsCount} dons
                  {c._count.donations > 0 && <span className="ms-2 font-semibold text-navy-700">{c._count.donations} à vérifier</span>}
                </p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
