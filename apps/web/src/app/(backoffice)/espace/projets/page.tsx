import Link from 'next/link'
import { EmptyState, PageHeader, SegmentedLinks, StatusTag } from '@/components/ui/blocks'
import { IconUsers } from '@/components/ui/icons'
import { prisma, type ProjectStatus } from '@solident/db'
import { AvatarStack } from '@/components/space/avatar'
import { requireMemberPage } from '@/lib/space'
import { PROJECT_STATUSES, projectStatusLabel, projectStatusTone } from '@/lib/space-labels'
import { ContextEditorToggle } from '../_lib/context-widgets'

export const metadata = { title: 'Projets' }

export default async function ProjectsPage({ searchParams }: PageProps<'/espace/projets'>) {
  const user = await requireMemberPage()
  const { statut } = await searchParams
  const status = PROJECT_STATUSES.find((s) => s === statut) as ProjectStatus | undefined
  const [projects, taskStats] = await Promise.all([
    prisma.project.findMany({
      where: { approvalStatus: 'approuve', ...(status && { status }) },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { members: { include: { user: { select: { id: true, name: true, image: true } } } }, parent: { select: { name: true } } },
    }),
    prisma.task.groupBy({ by: ['contextId', 'status'], where: { contextType: 'project', archived: false }, _count: true }),
  ])
  const stat = (id: string) => {
    const rows = taskStats.filter((s) => s.contextId === id)
    const total = rows.reduce((n, r) => n + r._count, 0)
    const done = rows.find((r) => r.status === 'termine')?._count ?? 0
    const blocked = rows.find((r) => r.status === 'bloque')?._count ?? 0
    return { total, done, blocked, pct: total ? Math.round((done / total) * 100) : 0 }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projets"
        description="Les activités de l’association et leurs équipes."
        actions={user.isSpaceAdmin ? <ContextEditorToggle label="Nouveau projet" type="project" projects={projects.map((p) => ({ id: p.id, name: p.name }))} /> : undefined}
      />
      <SegmentedLinks
        label="Statut des projets"
        items={[{ href: '/espace/projets', label: 'Tous', active: !status }, ...PROJECT_STATUSES.map((s) => ({ href: `/espace/projets?statut=${s}`, label: projectStatusLabel[s], active: status === s }))]}
      />
      {projects.length === 0 && (
        <EmptyState icon={<IconUsers />} title="Aucun projet ici">
          Aucun projet n’a ce statut pour l’instant.
        </EmptyState>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const s = stat(p.id)
          return (
            <li key={p.id}>
              <Link href={`/espace/projets/${p.id}`} className="card card-hover flex h-full flex-col overflow-hidden">
                <div className="relative h-28 bg-gradient-to-br from-navy-700 to-navy-900">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                  )}
                  <StatusTag tone={projectStatusTone[p.status]} className="absolute end-2 top-2 bg-white shadow-sm">
                    {projectStatusLabel[p.status]}
                  </StatusTag>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="font-heading font-bold text-navy-900">{p.name}</p>
                  {p.parent && <p className="text-xs text-ink-600">Sous-projet de {p.parent.name}</p>}
                  <div className="mt-auto space-y-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
                      <div className="h-full bg-success" style={{ width: `${s.pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-600">
                      <span>
                        {s.done}/{s.total} tâches{s.blocked > 0 && <span className="font-semibold text-danger"> · {s.blocked} bloquée{s.blocked > 1 ? 's' : ''}</span>}
                      </span>
                      <AvatarStack people={p.members.map((m) => m.user)} />
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
