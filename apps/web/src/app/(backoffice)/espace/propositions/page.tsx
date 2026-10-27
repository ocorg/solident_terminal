import { EmptyState, PageHeader, SegmentedLinks, StatusTag } from '@/components/ui/blocks'
import { IconInbox } from '@/components/ui/icons'
import { prisma } from '@solident/db'
import { requireMemberPage } from '@/lib/space'
import { approvalLabel, approvalTone } from '@/lib/space-labels'
import { ProposalForm, ReviewButtons, WithdrawButton } from './proposal-widgets'

export const metadata = { title: 'Propositions' }
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Propositions"
        description={user.isSpaceAdmin ? 'Toutes les propositions de projets et d’activités.' : 'Vos propositions. Les administrateurs de l’espace les examinent.'}
        actions={<ProposalForm projects={projects} people={people} />}
      />
      <SegmentedLinks
        label="Statut"
        items={[
          { href: '/espace/propositions', label: 'Toutes', active: !status },
          ...(['en_attente', 'approuve', 'rejete'] as const).map((s) => ({ href: `/espace/propositions?statut=${s}`, label: approvalLabel[s], active: status === s })),
        ]}
      />
      {proposals.length === 0 && (
        <EmptyState icon={<IconInbox />} title="Aucune proposition">
          Une idée de projet ou d’activité ? Proposez-la : les administrateurs de l’espace l’examineront.
        </EmptyState>
      )}
      <ul className="space-y-3">
        {proposals.map((p) => (
          <li key={p.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-lg font-bold text-navy-900">
                  {p.title} <StatusTag tone={approvalTone[p.status]} className="ms-2 align-middle">
                    {approvalLabel[p.status]}
                  </StatusTag>
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
