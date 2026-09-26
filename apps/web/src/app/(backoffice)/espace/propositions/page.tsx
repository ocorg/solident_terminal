import Link from 'next/link'
import { prisma, type ApprovalStatus } from '@solident/db'
import { requireMemberPage } from '@/lib/space'
import { approvalLabel } from '@/lib/space-labels'
import { ProposalForm, ReviewButtons, WithdrawButton } from './proposal-widgets'

export const metadata = { title: 'Propositions' }
const style: Record<ApprovalStatus, string> = { en_attente: 'bg-gold-100 text-navy-900', approuve: 'bg-success/15 text-success', rejete: 'bg-danger/15 text-danger' }
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Casablanca' })

export default async function ProposalsPage({ searchParams }: PageProps<'/espace/propositions'>) {
  const user = await requireMemberPage()
  const { statut } = await searchParams
  const status = (['en_attente', 'approuve', 'rejete'] as const).find((s) => s === statut)
  const [proposals, projects, people] = await Promise.all([
    prisma.projectProposal.findMany({
      where: { ...(status && { status }), ...(!user.isSpaceAdmin && { proposedById: user.id }) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { proposedBy: { select: { name: true } }, suggestedChef: { select: { name: true } }, parentProject: { select: { name: true } }, reviewedBy: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: { approvalStatus: 'approuve' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-sm font-semibold ${active ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 hover:bg-navy-100'}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-700">Propositions</h1>
          <p className="text-sm text-ink-600">{user.isSpaceAdmin ? 'Toutes les propositions de projets et d’activités.' : 'Vos propositions. Les administrateurs de l’espace les examinent.'}</p>
        </div>
        <ProposalForm projects={projects} people={people} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/espace/propositions" className={chip(!status)}>
          Toutes
        </Link>
        {(['en_attente', 'approuve', 'rejete'] as const).map((s) => (
          <Link key={s} href={`/espace/propositions?statut=${s}`} className={chip(status === s)}>
            {approvalLabel[s]}
          </Link>
        ))}
      </div>
      {proposals.length === 0 && <p className="card p-6 text-ink-600">Aucune proposition.</p>}
      <ul className="space-y-3">
        {proposals.map((p) => (
          <li key={p.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-lg font-bold text-navy-900">
                  {p.title} <span className={`ms-2 rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${style[p.status]}`}>{approvalLabel[p.status]}</span>
                </p>
                <p className="text-xs text-ink-600">
                  {p.type}
                  {p.parentProject && ` de « ${p.parentProject.name} »`} · proposé par {p.proposedBy.name} le {day(p.createdAt)}
                  {p.suggestedChef && ` · chef suggéré : ${p.suggestedChef.name}`}
                </p>
              </div>
              {p.status === 'en_attente' && p.proposedById === user.id && <WithdrawButton id={p.id} />}
            </div>
            {p.description && <p className="whitespace-pre-wrap text-sm text-ink-600">{p.description}</p>}
            {p.reviewNotes && (
              <p className="rounded-lg bg-cream-50 px-3 py-2 text-sm">
                <span className="font-semibold">{p.reviewedBy?.name ?? 'Décision'} :</span> {p.reviewNotes}
              </p>
            )}
            {p.status === 'en_attente' && user.isSpaceAdmin && <ReviewButtons id={p.id} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
