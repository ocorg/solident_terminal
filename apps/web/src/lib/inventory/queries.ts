import 'server-only'
import { prisma, type InventoryMovementType, type Prisma } from '@solident/db'
import { Decimal, getBalances, totalsByItem } from '@solident/db/inventory'
import { localInputToDate } from '@/lib/tz'

// Read side of the inventory. Decimals leave the server as strings (exact, serializable).

export type ItemDTO = {
  id: string
  name: string
  category: 'consommable' | 'instrument' | 'equipement'
  subcategory: string | null
  unit: string
  minQty: string | null
  photoUrl: string | null
  notes: string | null
  isDemo: boolean
  isDeleted: boolean
  total: string
  low: boolean
  /** Some quantity of this item was entered as an estimate. */
  estimate: boolean
}
export type Person = { id: string; name: string; image: string | null; isActive: boolean }
export type BalanceDTO = { itemId: string; holderId: string; qty: string }

/** Catalogue + balances + people, for the inventory pages and the forms. */
export async function loadInventory(opts: { includeArchived?: boolean } = {}) {
  const [items, balances, estimates, members] = await Promise.all([
    prisma.inventoryItem.findMany({ where: opts.includeArchived ? {} : { isDeleted: false }, orderBy: [{ category: 'asc' }, { subcategory: 'asc' }, { name: 'asc' }] }),
    getBalances(prisma),
    prisma.inventoryMovement.groupBy({ by: ['itemId'], where: { isEstimate: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, image: true, isActive: true } }),
  ])
  const totals = totalsByItem(balances)
  const est = new Set(estimates.map((e) => e.itemId))
  const itemDTOs: ItemDTO[] = items.map((i) => {
    const total = totals.get(i.id) ?? new Decimal(0)
    return {
      id: i.id,
      name: i.name,
      category: i.category,
      subcategory: i.subcategory,
      unit: i.unit,
      minQty: i.minQty?.toString() ?? null,
      photoUrl: i.photoUrl,
      notes: i.notes,
      isDemo: i.isDemo,
      isDeleted: i.isDeleted,
      total: total.toString(),
      low: !!i.minQty && total.lt(i.minQty),
      estimate: est.has(i.id),
    }
  })
  // Holders = everyone with stock (including deactivated accounts, so nothing is hidden), then active members.
  const holderIds = [...new Set(balances.map((b) => b.holderId))]
  const missing = holderIds.filter((id) => !members.some((m) => m.id === id))
  const inactive = missing.length
    ? await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, name: true, image: true, isActive: true } })
    : []
  const people: Person[] = [...members, ...inactive]
  const holders = people.filter((p) => holderIds.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return {
    items: itemDTOs,
    balances: balances.map((b) => ({ itemId: b.itemId, holderId: b.holderId, qty: b.qty.toString() })) satisfies BalanceDTO[],
    holders,
    members: members as Person[],
  }
}

export type MovementDTO = {
  id: string
  createdAt: string
  type: InventoryMovementType
  qty: string
  isEstimate: boolean
  source: 'don' | 'achat' | 'emprunt' | null
  note: string | null
  item: { id: string; name: string; unit: string }
  from: { id: string; name: string } | null
  to: { id: string; name: string } | null
  project: { id: string; name: string } | null
  countId: string | null
  createdBy: string
  reversesId: string | null
  reversed: boolean
}

const movementInclude = {
  item: { select: { id: true, name: true, unit: true } },
  fromHolder: { select: { id: true, name: true } },
  toHolder: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  reversedBy: { select: { id: true } },
} satisfies Prisma.InventoryMovementInclude

type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>
const toDTO = (m: MovementRow): MovementDTO => ({
  id: m.id,
  createdAt: m.createdAt.toISOString(),
  type: m.type,
  qty: m.qty.toString(),
  isEstimate: m.isEstimate,
  source: m.source,
  note: m.note,
  item: m.item,
  from: m.fromHolder,
  to: m.toHolder,
  project: m.project,
  countId: m.countId,
  createdBy: m.createdBy.name,
  reversesId: m.reversesId,
  reversed: !!m.reversedBy,
})

export type HistoryFilter = { itemId?: string; memberId?: string; type?: InventoryMovementType; projectId?: string; from?: string; to?: string }
export const HISTORY_PAGE = 50

export async function loadMovements(f: HistoryFilter, page = 1) {
  const where: Prisma.InventoryMovementWhereInput = {
    ...(f.itemId && { itemId: f.itemId }),
    ...(f.type && { type: f.type }),
    ...(f.projectId && { projectId: f.projectId }),
    ...(f.memberId && { OR: [{ fromHolderId: f.memberId }, { toHolderId: f.memberId }] }),
    ...((f.from || f.to) && {
      createdAt: { ...(f.from && { gte: localInputToDate(`${f.from}T00:00`) }), ...(f.to && { lte: new Date(localInputToDate(`${f.to}T23:59`).getTime() + 59_999) }) },
    }),
  }
  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({ where, include: movementInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * HISTORY_PAGE, take: HISTORY_PAGE }),
    prisma.inventoryMovement.count({ where }),
  ])
  return { rows: rows.map(toDTO), total }
}

/** Projects for pickers and filters (demo project included so the demo can be explored). */
export async function projectOptions() {
  return prisma.project.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }], select: { id: true, name: true, status: true } })
}

/** The project inventory tab: needs, collecte, counts. */
export async function loadProjectInventory(projectId: string) {
  const [needs, collecte, counts, used] = await Promise.all([
    prisma.inventoryNeed.findMany({ where: { projectId }, include: { item: true }, orderBy: { item: { name: 'asc' } } }),
    prisma.inventoryMovement.findMany({ where: { projectId, type: 'entree', reversesId: null }, include: movementInclude, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryCount.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } }, createdBy: { select: { name: true } }, validatedBy: { select: { name: true } }, _count: { select: { lines: true } } },
    }),
    // Other projects that have a needs list (for "copy from").
    prisma.project.findMany({ where: { id: { not: projectId }, inventoryNeeds: { some: {} } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  // Collected for this project = entries tagged with it, minus the ones that were undone.
  const collected = new Map<string, Decimal>()
  for (const m of collecte) if (!m.reversedBy) collected.set(m.itemId, (collected.get(m.itemId) ?? new Decimal(0)).plus(m.qty))
  return {
    needs: needs.map((n) => ({
      id: n.id,
      itemId: n.itemId,
      itemName: n.item.name,
      unit: n.item.unit,
      category: n.item.category,
      qtyNeeded: n.qtyNeeded.toString(),
      collected: (collected.get(n.itemId) ?? new Decimal(0)).toString(),
      note: n.note,
    })),
    collecte: collecte.filter((m) => !m.reversedBy).map(toDTO),
    counts: counts.map((c) => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      validatedAt: c.validatedAt?.toISOString() ?? null,
      createdBy: c.createdBy.name,
      validatedBy: c.validatedBy?.name ?? null,
      lines: c._count.lines,
      project: c.project,
    })),
    copySources: used,
  }
}

/** A count with its lines, for the count sheet and the bilan. */
export async function loadCount(countId: string) {
  const count = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    include: {
      project: { select: { id: true, name: true, startDate: true, endDate: true } },
      createdBy: { select: { name: true } },
      validatedBy: { select: { name: true } },
      lines: {
        include: { item: { select: { id: true, name: true, unit: true, category: true, subcategory: true, photoUrl: true } }, holder: { select: { id: true, name: true } } },
      },
    },
  })
  if (!count) return null
  const lines = count.lines
    .map((l) => ({
      id: l.id,
      item: l.item,
      holder: l.holder,
      snapshotQty: l.snapshotQty.toString(),
      expectedQty: l.expectedQty?.toString() ?? null,
      countedQty: l.countedQty?.toString() ?? null,
      outcome: l.outcome,
      note: l.note,
    }))
    .sort((a, b) => a.holder.name.localeCompare(b.holder.name, 'fr') || a.item.name.localeCompare(b.item.name, 'fr'))
  return {
    id: count.id,
    status: count.status,
    notes: count.notes,
    isDemo: count.isDemo,
    createdAt: count.createdAt.toISOString(),
    updatedAt: count.updatedAt.toISOString(),
    validatedAt: count.validatedAt?.toISOString() ?? null,
    createdById: count.createdById,
    createdBy: count.createdBy.name,
    validatedBy: count.validatedBy?.name ?? null,
    project: count.project ? { id: count.project.id, name: count.project.name } : null,
    lines,
  }
}
export type CountDTO = NonNullable<Awaited<ReturnType<typeof loadCount>>>
