// Inventory ledger core, shared by apps/web and the demo script.
// Stock is never stored: a holder's balance = Σ qty moved to them − Σ qty moved from them.
// Every quantity is a Prisma Decimal (never a JavaScript float).
import { Prisma, type InventoryCategory, type InventoryLineOutcome, type PrismaClient } from './generated/prisma/client'

export const Decimal = Prisma.Decimal
export type Decimal = Prisma.Decimal
export type Db = PrismaClient | Prisma.TransactionClient

export type Balance = { itemId: string; holderId: string; qty: Decimal }

const ZERO = new Decimal(0)
const key = (itemId: string, holderId: string) => `${itemId}:${holderId}`

/**
 * Non-zero balances per (item, holder), computed from the ledger in two grouped queries.
 * The one balance function: every screen and every check goes through it.
 */
export async function getBalances(db: Db, filter: { itemIds?: string[]; holderIds?: string[] } = {}): Promise<Balance[]> {
  const item = filter.itemIds ? { itemId: { in: filter.itemIds } } : {}
  const [ins, outs] = await Promise.all([
    db.inventoryMovement.groupBy({
      by: ['itemId', 'toHolderId'],
      where: { ...item, toHolderId: filter.holderIds ? { in: filter.holderIds } : { not: null } },
      _sum: { qty: true },
    }),
    db.inventoryMovement.groupBy({
      by: ['itemId', 'fromHolderId'],
      where: { ...item, fromHolderId: filter.holderIds ? { in: filter.holderIds } : { not: null } },
      _sum: { qty: true },
    }),
  ])
  const map = new Map<string, Balance>()
  for (const r of ins) {
    const holderId = r.toHolderId!
    map.set(key(r.itemId, holderId), { itemId: r.itemId, holderId, qty: r._sum.qty ?? ZERO })
  }
  for (const r of outs) {
    const holderId = r.fromHolderId!
    const b = map.get(key(r.itemId, holderId)) ?? { itemId: r.itemId, holderId, qty: ZERO }
    map.set(key(r.itemId, holderId), { ...b, qty: b.qty.minus(r._sum.qty ?? ZERO) })
  }
  return [...map.values()].filter((b) => !b.qty.isZero())
}

/** One holder's balance of one item. */
export async function holderBalance(db: Db, itemId: string, holderId: string): Promise<Decimal> {
  const b = await getBalances(db, { itemIds: [itemId], holderIds: [holderId] })
  return b[0]?.qty ?? ZERO
}

/** Total stock per item (all holders). */
export function totalsByItem(balances: Balance[]) {
  const totals = new Map<string, Decimal>()
  for (const b of balances) totals.set(b.itemId, (totals.get(b.itemId) ?? ZERO).plus(b.qty))
  return totals
}

/**
 * Locks the items' rows until the transaction ends, so two writes that take stock out of the same
 * item run one after the other and the "no negative stock" check cannot be passed twice.
 * Sorted to avoid deadlocks when two transactions lock several items.
 */
export async function lockItems(tx: Prisma.TransactionClient, itemIds: string[]) {
  for (const id of [...new Set(itemIds)].sort()) await tx.$executeRaw`SELECT id FROM inventory_items WHERE id = ${id}::uuid FOR UPDATE`
}

/**
 * Count rule: gap = counted − expected. Missing consumables were consumed; missing instruments or
 * equipment were lost (the validator can switch it per line); a surplus is an adjustment.
 */
export function gapOutcome(category: InventoryCategory, counted: Decimal, expected: Decimal): InventoryLineOutcome {
  const gap = counted.minus(expected)
  if (gap.isZero()) return 'ok'
  if (gap.isPositive()) return 'ajustement'
  return category === 'consommable' ? 'consommation' : 'perte'
}

/**
 * Hard-deletes all inventory demo data in the right order (the only hard delete of the module).
 * Demo = rows flagged is_demo, plus anything attached to a demo item or a demo project
 * (the app flags such rows as demo when they are written, so no real data is touched).
 */
export async function clearInventoryDemo(tx: Prisma.TransactionClient) {
  const [items, projects] = await Promise.all([
    tx.inventoryItem.findMany({ where: { isDemo: true }, select: { id: true } }),
    tx.project.findMany({ where: { isDemo: true }, select: { id: true } }),
  ])
  const itemIds = items.map((i) => i.id)
  const projectIds = projects.map((p) => p.id)
  const counts = await tx.inventoryCount.findMany({ where: { OR: [{ isDemo: true }, { projectId: { in: projectIds } }] }, select: { id: true } })
  const countIds = counts.map((c) => c.id)

  const demoMovement = { OR: [{ isDemo: true }, { itemId: { in: itemIds } }, { projectId: { in: projectIds } }, { countId: { in: countIds } }] }
  // Undo rows first: they point at the movement they reverse.
  const undos = await tx.inventoryMovement.deleteMany({ where: { ...demoMovement, reversesId: { not: null } } })
  const movements = await tx.inventoryMovement.deleteMany({ where: demoMovement })
  const lines = await tx.inventoryCountLine.deleteMany({ where: { OR: [{ countId: { in: countIds } }, { itemId: { in: itemIds } }] } })
  const deletedCounts = await tx.inventoryCount.deleteMany({ where: { id: { in: countIds } } })
  const needs = await tx.inventoryNeed.deleteMany({ where: { OR: [{ isDemo: true }, { itemId: { in: itemIds } }, { projectId: { in: projectIds } }] } })
  const deletedItems = await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } })
  // Demo project: its tasks have no foreign key (context id), so remove them explicitly.
  await tx.taskContext.deleteMany({ where: { contextType: 'project', contextId: { in: projectIds } } })
  await tx.task.deleteMany({ where: { contextType: 'project', contextId: { in: projectIds } } })
  const deletedProjects = await tx.project.deleteMany({ where: { id: { in: projectIds } } })

  return {
    movements: undos.count + movements.count,
    countLines: lines.count,
    counts: deletedCounts.count,
    needs: needs.count,
    items: deletedItems.count,
    projects: deletedProjects.count,
  }
}
