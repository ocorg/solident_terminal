import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma, type InventoryMovementType } from '@solident/db'
import { CatalogView } from '@/components/inventory/catalog-view'
import { EquipmentView } from '@/components/inventory/equipment-view'
import { MovementButton, type MovementContext } from '@/components/inventory/movement-form'
import { MovementList } from '@/components/inventory/movement-list'
import { NewCountButton } from '@/components/inventory/new-count-button'
import { StockView } from '@/components/inventory/stock-view'
import { CountList } from '@/components/inventory/count-list'
import { MOVEMENT_TYPES, movementLabel } from '@/lib/inventory/labels'
import { HISTORY_PAGE, loadInventory, loadMovements, projectOptions } from '@/lib/inventory/queries'
import { inventoryRights } from '@/lib/inventory/rights'
import { requireMemberPage } from '@/lib/space'

export const metadata: Metadata = { title: 'Inventaire' }

const TABS = [
  { key: 'stock', label: 'Stock' },
  { key: 'equipements', label: 'Équipements' },
  { key: 'inventaires', label: 'Inventaires' },
  { key: 'historique', label: 'Historique' },
  { key: 'catalogue', label: 'Catalogue' },
] as const
type TabKey = (typeof TABS)[number]['key']

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined
const uuid = (v: string | undefined) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)
const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)

export default async function InventoryPage({ searchParams }: PageProps<'/espace/inventaire'>) {
  const user = await requireMemberPage()
  const sp = await searchParams
  const rights = await inventoryRights(user)
  const tabs = TABS.filter((t) => t.key !== 'catalogue' || rights.canManageCatalog)
  const requested = one(sp.onglet) as TabKey | undefined
  const tab: TabKey = tabs.some((t) => t.key === requested) ? requested! : 'stock'

  const [inv, projects] = await Promise.all([loadInventory({ includeArchived: tab === 'catalogue' }), projectOptions()])
  const live = inv.items.filter((i) => !i.isDeleted)
  const ctx: MovementContext = {
    items: live,
    balances: inv.balances,
    members: inv.members,
    holders: inv.holders,
    me: { id: user.id, name: user.name },
    canMoveAny: rights.canMoveAny,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  }

  const tabHref = (key: TabKey) => (key === 'stock' ? '/espace/inventaire' : `/espace/inventaire?onglet=${key}`)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">Logistique</p>
          <h1 className="font-heading text-3xl font-bold text-navy-900">
            Inventaire<span className="brand-dot" aria-hidden />
          </h1>
          <p className="text-ink-600">Le matériel de l’association, qui le détient, et tout ce qui entre et sort.</p>
        </div>
        <div className={`grid w-full gap-2 sm:flex sm:w-auto ${rights.canManageProject ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <MovementButton kind="entree" ctx={ctx} className="btn btn-primary min-h-12 px-3 text-sm sm:text-base">
            Nouvelle entrée
          </MovementButton>
          <MovementButton kind="transfert" ctx={ctx} className="btn btn-ghost min-h-12 px-3 text-sm sm:text-base">
            Transfert
          </MovementButton>
          {rights.canManageProject && <NewCountButton className="btn btn-ghost min-h-12 px-3 text-sm sm:text-base" />}
        </div>
      </div>

      <nav aria-label="Sections de l’inventaire" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-navy-100">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={tabHref(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`-mb-px block border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === t.key ? 'border-gold-500 text-navy-900' : 'border-transparent text-ink-600 hover:border-navy-100 hover:text-navy-900'}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'stock' && <StockView items={live} ctx={ctx} canUndo={rights.canUndo} />}
      {tab === 'equipements' && <EquipmentView items={live} ctx={ctx} />}
      {tab === 'inventaires' && <CountsTab />}
      {tab === 'historique' && <HistoryTab sp={sp} items={inv.items} people={[...inv.members, ...inv.holders.filter((h) => !h.isActive)]} projects={projects} canUndo={rights.canUndo} />}
      {tab === 'catalogue' && <CatalogView items={inv.items} canClearDemo={rights.canClearDemo} />}
    </div>
  )
}

async function CountsTab() {
  const counts = await prisma.inventoryCount.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: { project: { select: { id: true, name: true } }, createdBy: { select: { name: true } }, validatedBy: { select: { name: true } }, _count: { select: { lines: true } } },
  })
  return (
    <CountList
      counts={counts.map((c) => ({
        id: c.id,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        validatedAt: c.validatedAt?.toISOString() ?? null,
        createdBy: c.createdBy.name,
        validatedBy: c.validatedBy?.name ?? null,
        lines: c._count.lines,
        project: c.project,
      }))}
      empty="Aucun inventaire pour l’instant. « Nouvel inventaire » compte tout le stock ; pour un bilan de caravane, passez par l’onglet Inventaire du projet."
    />
  )
}

async function HistoryTab({
  sp,
  items,
  people,
  projects,
  canUndo,
}: {
  sp: Record<string, string | string[] | undefined>
  items: { id: string; name: string }[]
  people: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  canUndo: boolean
}) {
  const typeParam = one(sp.type)
  const f = {
    itemId: uuid(one(sp.article)),
    memberId: uuid(one(sp.membre)),
    projectId: uuid(one(sp.projet)),
    type: MOVEMENT_TYPES.includes(typeParam as InventoryMovementType) ? (typeParam as InventoryMovementType) : undefined,
    from: day(one(sp.du)),
    to: day(one(sp.au)),
  }
  const page = Math.max(1, Number(one(sp.page)) || 1)
  const { rows, total } = await loadMovements(f, page)
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE))
  const qs = (p: number) => {
    const q = new URLSearchParams({ onglet: 'historique' })
    for (const [k, v] of Object.entries({ article: f.itemId, membre: f.memberId, projet: f.projectId, type: f.type, du: f.from, au: f.to })) if (v) q.set(k, v)
    if (p > 1) q.set('page', String(p))
    return `/espace/inventaire?${q}`
  }
  const sel = 'h-11 w-full rounded-[10px] border border-navy-100 bg-white px-3 text-sm'
  return (
    <div className="space-y-4">
      <form method="get" className="card grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6" data-no-guard>
        <input type="hidden" name="onglet" value="historique" />
        <select name="article" defaultValue={f.itemId ?? ''} className={sel} aria-label="Article">
          <option value="">Tous les articles</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select name="membre" defaultValue={f.memberId ?? ''} className={sel} aria-label="Membre">
          <option value="">Tous les membres</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={f.type ?? ''} className={sel} aria-label="Type">
          <option value="">Tous les types</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {movementLabel[t]}
            </option>
          ))}
        </select>
        <select name="projet" defaultValue={f.projectId ?? ''} className={sel} aria-label="Projet">
          <option value="">Tous les projets</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:col-span-2">
          <input type="date" name="du" defaultValue={f.from} className={sel} aria-label="Du" />
          <input type="date" name="au" defaultValue={f.to} className={sel} aria-label="Au" />
        </div>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="btn btn-primary min-h-11">
            Filtrer
          </button>
          <Link href="/espace/inventaire?onglet=historique" className="btn btn-ghost min-h-11">
            Réinitialiser
          </Link>
          <p className="ms-auto self-center text-sm text-ink-600">{total} mouvement(s)</p>
        </div>
      </form>
      <div className="card px-4 py-1">
        <MovementList rows={rows} canUndo={canUndo} />
      </div>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={qs(page - 1)} className="btn btn-ghost min-h-11">
              ← Plus récents
            </Link>
          )}
          <span>
            Page {page} / {pages}
          </span>
          {page < pages && (
            <Link href={qs(page + 1)} className="btn btn-ghost min-h-11">
              Plus anciens →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
