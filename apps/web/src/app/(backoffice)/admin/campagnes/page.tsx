import { EmptyState } from '@/components/ui/blocks'
import { IconInbox } from '@/components/ui/icons'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@solident/db'
import { getFundraising } from '@/lib/fundraising'
import { requireRolePage } from '@/lib/guards'
import { FundraisingCard } from './fundraising-card'

export const metadata: Metadata = { title: 'Campagnes' }

const dh = (n: number) => new Intl.NumberFormat('fr-MA').format(n) + ' DH'
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function CampagnesPage() {
  await requireRolePage('admin', 'treasurer')
  const fundraising = await getFundraising()
  const campaigns = await prisma.campaign.findMany({
    orderBy: [{ isActive: 'desc' }, { startsOn: 'desc' }],
    include: { _count: { select: { donations: { where: { status: 'pending' } } } } },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold text-navy-900">Campagnes<span className="brand-dot" aria-hidden /></h1>
        <Link href="/admin/campagnes/nouvelle" className="btn btn-primary">
          Nouvelle campagne
        </Link>
      </div>
      <FundraisingCard open={fundraising.open} authorization={fundraising.authorization ?? ''} />
      {campaigns.length === 0 && <EmptyState icon={<IconInbox />} title="Aucune campagne" />}
      <div className="grid gap-4">
        {campaigns.map((c) => {
          const pct = c.goalDh ? Math.min(100, Math.round((c.raisedDh / c.goalDh) * 100)) : 0
          return (
            <Link key={c.id} href={`/admin/campagnes/${c.id}`} className="card card-hover block p-5">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {c.titleFr}{' '}
                    <span className={`ms-2 rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${c.isActive ? 'bg-success/10 text-success' : 'bg-navy-100 text-ink-600'}`}>
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
