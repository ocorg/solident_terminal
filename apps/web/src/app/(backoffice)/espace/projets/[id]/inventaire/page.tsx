import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@solident/db'
import { CountList } from '@/components/inventory/count-list'
import { MovementButton, type MovementContext } from '@/components/inventory/movement-form'
import { NeedsSection } from '@/components/inventory/needs-section'
import { NewCountButton } from '@/components/inventory/new-count-button'
import { Tag } from '@/components/ui'
import { formatQty, sourceLabel } from '@/lib/inventory/labels'
import { loadInventory, loadProjectInventory, projectOptions } from '@/lib/inventory/queries'
import { inventoryRights } from '@/lib/inventory/rights'
import { requireMemberPage } from '@/lib/space'
import { ProjectTabs } from '../../../_lib/project-tabs'

export const metadata: Metadata = { title: 'Inventaire du projet' }

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Casablanca' })

export default async function ProjectInventoryPage({ params }: PageProps<'/espace/projets/[id]/inventaire'>) {
  const user = await requireMemberPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true, parent: { select: { id: true, name: true } } } })
  if (!project) notFound()

  const [rights, inv, data, projects] = await Promise.all([inventoryRights(user, id), loadInventory(), loadProjectInventory(id), projectOptions()])
  const totals = new Map(inv.items.map((i) => [i.id, i.total]))
  const ctx: MovementContext = {
    items: inv.items,
    balances: inv.balances,
    members: inv.members,
    holders: inv.holders,
    me: { id: user.id, name: user.name },
    canMoveAny: rights.canMoveAny,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  }

  // Collecte grouped by member, then by source.
  const byMember = new Map<string, { name: string; rows: typeof data.collecte }>()
  for (const m of data.collecte) {
    const k = m.to?.id ?? '—'
    const g = byMember.get(k) ?? { name: m.to?.name ?? '—', rows: [] }
    g.rows.push(m)
    byMember.set(k, g)
  }
  const drafts = data.counts.filter((c) => c.status === 'brouillon')

  return (
    <div className="space-y-6">
      <Link href="/espace/projets" className="text-sm font-semibold text-navy-700 hover:underline">
        ← Projets
      </Link>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">
          Projet
          {project.parent && (
            <>
              {' · sous-projet de '}
              <Link href={`/espace/projets/${project.parent.id}`} className="underline">
                {project.parent.name}
              </Link>
            </>
          )}
        </p>
        <h1 className="font-heading text-3xl font-bold text-navy-900">{project.name}</h1>
      </div>
      <ProjectTabs projectId={id} active="inventaire" />

      <NeedsSection
        projectId={id}
        canManage={rights.canManageProject}
        items={inv.items}
        copySources={data.copySources}
        needs={data.needs.map((n) => ({ ...n, stock: totals.get(n.itemId) ?? '0' }))}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-xl font-bold text-navy-700">Collecte</h2>
            <p className="text-sm text-ink-600">Tout ce qui a été collecté pour ce projet (dons, achats, emprunts).</p>
          </div>
          <MovementButton kind="entree" ctx={ctx} defaults={{ projectId: id }} variant="primary">
            Ajouter ma collecte
          </MovementButton>
        </div>
        {byMember.size ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[...byMember.values()].map((g) => (
              <div key={g.name} className="card p-4">
                <h3 className="mb-2 font-heading font-bold text-navy-900">
                  {g.name} <span className="text-sm font-normal text-ink-600">({g.rows.length})</span>
                </h3>
                {(['don', 'achat', 'emprunt'] as const).map((src) => {
                  const rows = g.rows.filter((r) => r.source === src)
                  if (!rows.length) return null
                  return (
                    <div key={src} className="mb-2">
                      <Tag tone="muted">{sourceLabel[src]}</Tag>
                      <ul className="mt-1 space-y-0.5 text-sm">
                        {rows.map((r) => (
                          <li key={r.id} className="flex justify-between gap-2">
                            <span className="min-w-0 truncate">
                              {r.item.name}
                              {r.note && <span className="text-ink-600"> · {r.note}</span>}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatQty(r.qty, r.isEstimate)} {r.item.unit} <span className="text-xs text-ink-600">{day(r.createdAt)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="card p-5 text-sm text-ink-600">Rien de collecté pour l’instant. Chaque membre peut ajouter ce qu’il a récupéré depuis son téléphone.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-xl font-bold text-navy-700">Bilan</h2>
            <p className="text-sm text-ink-600">Après l’activité : on recompte tout pour voir ce qui a été consommé, ce qui manque, et qui détient quoi.</p>
          </div>
          {rights.canManageProject && (
            <NewCountButton projectId={id} variant="primary">
              {drafts.length ? 'Continuer le bilan' : 'Nouveau bilan'}
            </NewCountButton>
          )}
        </div>
        <CountList counts={data.counts} empty="Aucun bilan pour ce projet." />
      </section>
    </div>
  )
}
