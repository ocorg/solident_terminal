import Link from 'next/link'
import { prisma } from '@solident/db'
import { requireRolePage, STAFF_ROLES } from '@/lib/guards'

const dh = (n: number) => new Intl.NumberFormat('fr-MA').format(n) + ' DH'

export default async function AdminHome() {
  const { user, role } = await requireRolePage(...STAFF_ROLES)
  const money = role === 'admin' || role === 'treasurer'

  const [campaigns, pendingDonations, pendingUsers] = await Promise.all([
    prisma.campaign.findMany({ where: { isActive: true }, orderBy: { startsOn: 'asc' } }),
    money ? prisma.donation.aggregate({ where: { status: 'pending' }, _count: true, _sum: { amountDh: true } }) : null,
    role === 'admin' ? prisma.user.count({ where: { isActive: false } }) : 0,
  ])

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Bonjour {user.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pendingDonations && (
          <Link href="/admin/dons" className="card card-hover p-5">
            <p className="text-sm text-ink-600">Dons à vérifier</p>
            <p className="font-heading text-3xl font-bold text-navy-700">{pendingDonations._count}</p>
            <p className="text-sm text-ink-600">{dh(pendingDonations._sum.amountDh ?? 0)} déclarés</p>
          </Link>
        )}
        {role === 'admin' && (
          <Link href="/admin/utilisateurs" className="card card-hover p-5">
            <p className="text-sm text-ink-600">Comptes en attente</p>
            <p className="font-heading text-3xl font-bold text-navy-700">{pendingUsers}</p>
            <p className="text-sm text-ink-600">à valider ou refuser</p>
          </Link>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-navy-700">Campagnes actives</h2>
        {campaigns.length === 0 && <p className="text-ink-600">Aucune campagne active.</p>}
        {campaigns.map((c) => {
          const pct = c.goalDh ? Math.min(100, Math.round((c.raisedDh / c.goalDh) * 100)) : 0
          return (
            <div key={c.id} className="card p-5">
              <div className="mb-2 flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{c.titleFr}</p>
                <p className="text-sm text-ink-600">
                  {dh(c.raisedDh)} / {dh(c.goalDh)} · {c.donorsCount} dons · <strong className="text-navy-700">{pct} %</strong>
                </p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
