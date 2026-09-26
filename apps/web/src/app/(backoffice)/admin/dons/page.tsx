import Link from 'next/link'
import { prisma, type DonationStatus } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { DecisionButtons, ProofButton } from './donation-actions'
import { ManualDonationForm } from './manual-form'

const tabs: { key: DonationStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'À vérifier' },
  { key: 'confirmed', label: 'Confirmés' },
  { key: 'rejected', label: 'Refusés' },
  { key: 'all', label: 'Tous' },
]
const statusStyle: Record<DonationStatus, string> = {
  pending: 'bg-gold-100 text-navy-900',
  confirmed: 'bg-success/15 text-success',
  rejected: 'bg-danger/15 text-danger',
}
const statusLabel: Record<DonationStatus, string> = { pending: 'À vérifier', confirmed: 'Confirmé', rejected: 'Refusé' }
const dh = (n: number) => new Intl.NumberFormat('fr-MA').format(n) + ' DH'
const date = (d: Date) => d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

export default async function DonsPage({ searchParams }: PageProps<'/admin/dons'>) {
  await requireRolePage('admin', 'treasurer')
  const { statut } = await searchParams
  const current = tabs.find((t) => t.key === statut)?.key ?? 'pending'

  const [donations, counts, campaigns, partners] = await Promise.all([
    prisma.donation.findMany({
      where: current === 'all' ? {} : { status: current },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { campaign: { select: { titleFr: true } }, partner: { select: { name: true } }, confirmedBy: { select: { name: true } } },
    }),
    prisma.donation.groupBy({ by: ['status'], _count: true }),
    prisma.campaign.findMany({ where: { isActive: true }, orderBy: { startsOn: 'asc' }, select: { id: true, titleFr: true } }),
    prisma.partner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const count = (k: string) => (k === 'all' ? counts.reduce((s, c) => s + c._count, 0) : (counts.find((c) => c.status === k)?._count ?? 0))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Dons</h1>
        {campaigns.length > 0 && (
          <ManualDonationForm campaigns={campaigns.map((c) => ({ id: c.id, label: c.titleFr }))} partners={partners.map((p) => ({ id: p.id, label: p.name }))} />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/dons?statut=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${current === t.key ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 hover:bg-navy-100'}`}
          >
            {t.label} <span className="opacity-70">({count(t.key)})</span>
          </Link>
        ))}
      </div>

      {donations.length === 0 ? (
        <p className="card p-6 text-ink-600">Aucun don dans cette liste.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-navy-100 text-start text-navy-900">
              <tr>
                {['Date', 'Donateur', 'Montant', 'Campagne', 'Justificatif', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-t border-navy-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                    {date(d.createdAt)}
                    {d.source === 'manual' && <div className="text-xs">ajout manuel</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{d.partner?.name ?? d.donorName ?? <span className="text-ink-600">Sans nom</span>}</div>
                    <div className="text-xs text-ink-600">
                      {d.partner ? 'Sponsor' : d.isAnonymous ? 'Anonyme sur le site' : 'Nom affiché sur le mur'}
                    </div>
                    {(d.email || d.phone) && <div className="text-xs text-ink-600">{[d.email, d.phone].filter(Boolean).join(' · ')}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-navy-700">{dh(d.amountDh)}</td>
                  <td className="px-4 py-3 text-ink-600">{d.campaign.titleFr}</td>
                  <td className="px-4 py-3">{d.proofKey ? <ProofButton id={d.id} /> : <span className="text-ink-600">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[d.status]}`}>{statusLabel[d.status]}</span>
                    {d.confirmedBy && d.status !== 'pending' && <div className="mt-1 text-xs text-ink-600">par {d.confirmedBy.name}</div>}
                    {d.adminNote && <div className="mt-1 max-w-48 text-xs text-ink-600">« {d.adminNote} »</div>}
                  </td>
                  <td className="px-4 py-3">
                    <DecisionButtons id={d.id} amountDh={d.amountDh} status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
