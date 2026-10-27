// Inventory demo data (all rows flagged is_demo).
//   pnpm db:inventory-demo seed    → ~20 items, movements held by 4 existing members, one demo caravan
//                                    with besoins, collecte and one validated bilan
//   pnpm db:inventory-demo clear   → hard-deletes every demo row (same code as the admin button)
// Production: DB_ENV_FILE=.env.production pnpm db:inventory-demo seed
import '../load-env'
import { prisma, type InventoryCategory, type InventorySource } from '../src/index'
import { clearInventoryDemo, Decimal, gapOutcome, getBalances } from '../src/inventory'

type ItemDef = { name: string; category: InventoryCategory; subcategory: string; unit: string; minQty?: number; notes?: string }

const ITEMS: ItemDef[] = [
  { name: 'Gants nitrile (taille M)', category: 'consommable', subcategory: 'Personnel', unit: 'boîtes', minQty: 10 },
  { name: 'Masques chirurgicaux', category: 'consommable', subcategory: 'Personnel', unit: 'boîtes', minQty: 4 },
  { name: 'Champs opératoires', category: 'consommable', subcategory: 'Personnel', unit: 'paquets', minQty: 10 },
  { name: 'Gobelets', category: 'consommable', subcategory: 'Personnel', unit: 'paquets' },
  { name: 'Compresses stériles', category: 'consommable', subcategory: 'Soins', unit: 'paquets', minQty: 20 },
  { name: 'Rouleaux salivaires', category: 'consommable', subcategory: 'Soins', unit: 'paquets', minQty: 5 },
  { name: "Carpules d'anesthésie", category: 'consommable', subcategory: 'Anesthésie', unit: 'boîtes', minQty: 8, notes: 'Articaïne 4 %, boîtes de 50' },
  { name: 'Aiguilles dentaires courtes', category: 'consommable', subcategory: 'Anesthésie', unit: 'boîtes', minQty: 4 },
  { name: 'Solution désinfectante', category: 'consommable', subcategory: 'Désinfection', unit: 'litres', minQty: 2 },
  { name: 'Syndesmotomes', category: 'instrument', subcategory: 'Extraction', unit: 'pièces' },
  { name: 'Élévateurs droits', category: 'instrument', subcategory: 'Extraction', unit: 'pièces' },
  { name: 'Curettes', category: 'instrument', subcategory: 'Extraction', unit: 'pièces' },
  { name: 'Daviers incisives supérieures', category: 'instrument', subcategory: 'Daviers', unit: 'pièces' },
  { name: 'Daviers molaires inférieures', category: 'instrument', subcategory: 'Daviers', unit: 'pièces' },
  { name: "Kits d'examen (miroir + sonde)", category: 'instrument', subcategory: 'Examen', unit: 'kits', minQty: 10 },
  { name: 'Précelles', category: 'instrument', subcategory: 'Examen', unit: 'pièces' },
  { name: 'Autoclave', category: 'equipement', subcategory: 'Stérilisation', unit: 'pièces', notes: 'Classe B, 18 L. Transport à deux personnes.' },
  { name: 'Détartreur ultrasonique', category: 'equipement', subcategory: 'Soins', unit: 'pièces' },
  { name: 'Turbine', category: 'equipement', subcategory: 'Soins', unit: 'pièces' },
  { name: 'Caméra intra-orale', category: 'equipement', subcategory: 'Examen', unit: 'pièces' },
  { name: 'Lampe frontale LED', category: 'equipement', subcategory: 'Examen', unit: 'pièces' },
]

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

async function seed() {
  if (await prisma.inventoryItem.count({ where: { isDemo: true } })) throw new Error('Demo data already present. Run "clear" first.')

  const admin = await prisma.user.findFirst({ where: { role: 'admin', isActive: true }, orderBy: { createdAt: 'asc' } })
  if (!admin) throw new Error('No active admin user')
  // Four holders: logistics people first, then other active members.
  const logistics = await prisma.user.findMany({
    where: { isActive: true, celluleMemberships: { some: { cellule: { name: { contains: 'Logisti', mode: 'insensitive' } } } } },
    orderBy: { createdAt: 'asc' },
    take: 4,
  })
  const others = await prisma.user.findMany({
    where: { isActive: true, id: { notIn: logistics.map((u) => u.id) } },
    orderBy: { createdAt: 'asc' },
    take: 4 - logistics.length,
  })
  const holders = [...logistics, ...others]
  if (holders.length < 4) throw new Error('Need at least 4 active members')
  const [A, B, C, D] = holders.map((u) => u.id) as [string, string, string, string]

  const summary = await prisma.$transaction(
    async (tx) => {
      const project = await tx.project.create({
        data: {
          name: '[Démo] Caravane test inventaire',
          description: "Projet de démonstration du module Inventaire. Supprimé par « Vider les données de démonstration ».",
          status: 'termine',
          isDemo: true,
          startDate: daysAgo(28),
          endDate: daysAgo(26),
          positions: { create: [{ name: 'Chef de Projet' }, { name: 'Membre' }] },
        },
        include: { positions: true },
      })
      const chef = project.positions.find((p) => p.name === 'Chef de Projet')!
      const member = project.positions.find((p) => p.name === 'Membre')!
      await tx.projectMember.createMany({
        data: [
          { projectId: project.id, userId: A, positionId: chef.id },
          ...[B, C, D].map((userId) => ({ projectId: project.id, userId, positionId: member.id })),
        ],
      })

      const ids: Record<string, string> = {}
      for (const it of ITEMS) {
        const row = await tx.inventoryItem.create({
          data: { ...it, minQty: it.minQty === undefined ? null : new Decimal(it.minQty), isDemo: true, createdById: admin.id, createdAt: daysAgo(70) },
        })
        ids[it.name] = row.id
      }
      const id = (name: string) => ids[name] ?? (() => { throw new Error(`Unknown demo item ${name}`) })()

      type M = { item: string; qty: number; type: 'entree' | 'transfert' | 'consommation'; to?: string; from?: string; source?: InventorySource; project?: boolean; estimate?: boolean; by?: string; ago: number; note?: string }
      const moves: M[] = [
        // General stock collected before the caravan.
        { item: 'Autoclave', qty: 1, type: 'entree', to: A, source: 'don', ago: 60, note: 'Don du cabinet partenaire' },
        { item: 'Détartreur ultrasonique', qty: 1, type: 'entree', to: B, source: 'achat', ago: 60 },
        { item: 'Détartreur ultrasonique', qty: 1, type: 'entree', to: C, source: 'achat', ago: 60 },
        { item: 'Turbine', qty: 1, type: 'entree', to: C, source: 'emprunt', ago: 58, note: 'Prêtée par la faculté, à rendre en décembre' },
        { item: 'Caméra intra-orale', qty: 1, type: 'entree', to: D, source: 'don', ago: 58 },
        { item: 'Lampe frontale LED', qty: 1, type: 'entree', to: D, source: 'achat', ago: 55 },
        { item: 'Syndesmotomes', qty: 6, type: 'entree', to: A, source: 'don', ago: 55 },
        { item: 'Élévateurs droits', qty: 6, type: 'entree', to: A, source: 'don', ago: 55 },
        { item: 'Curettes', qty: 8, type: 'entree', to: A, source: 'achat', ago: 55 },
        { item: 'Daviers incisives supérieures', qty: 4, type: 'entree', to: B, source: 'don', ago: 50 },
        { item: 'Daviers molaires inférieures', qty: 4, type: 'entree', to: B, source: 'don', ago: 50 },
        { item: "Kits d'examen (miroir + sonde)", qty: 15, type: 'entree', to: D, source: 'achat', ago: 50 },
        { item: 'Précelles', qty: 10, type: 'entree', to: D, source: 'achat', ago: 50 },
        { item: 'Gants nitrile (taille M)', qty: 6, type: 'entree', to: A, source: 'achat', ago: 45 },
        { item: 'Masques chirurgicaux', qty: 3, type: 'entree', to: A, source: 'achat', ago: 45 },
        // Collecte for the demo caravan (logged by each member).
        { item: 'Gants nitrile (taille M)', qty: 10, type: 'entree', to: B, source: 'don', project: true, ago: 35 },
        { item: 'Gobelets', qty: 20, type: 'entree', to: B, source: 'don', project: true, ago: 35 },
        { item: 'Compresses stériles', qty: 30, type: 'entree', to: C, source: 'don', project: true, ago: 34 },
        { item: "Carpules d'anesthésie", qty: 12, type: 'entree', to: C, source: 'achat', project: true, ago: 34 },
        { item: 'Aiguilles dentaires courtes', qty: 6, type: 'entree', to: C, source: 'achat', project: true, ago: 34 },
        { item: 'Champs opératoires', qty: 15, type: 'entree', to: D, source: 'don', project: true, ago: 33 },
        { item: 'Rouleaux salivaires', qty: 10, type: 'entree', to: D, source: 'don', project: true, ago: 33 },
        { item: 'Solution désinfectante', qty: 3.5, type: 'entree', to: A, source: 'achat', project: true, estimate: true, ago: 32, note: 'Bidons entamés' },
        // Equipment moves before departure.
        { item: 'Autoclave', qty: 1, type: 'transfert', from: A, to: B, project: true, by: A, ago: 30, note: 'Pour le transport en voiture' },
        { item: 'Caméra intra-orale', qty: 1, type: 'transfert', from: D, to: A, project: true, by: D, ago: 30 },
      ]
      await tx.inventoryMovement.createMany({
        data: moves.map((m) => ({
          itemId: id(m.item),
          qty: new Decimal(m.qty),
          type: m.type,
          fromHolderId: m.from ?? null,
          toHolderId: m.to ?? null,
          source: m.source ?? null,
          isEstimate: m.estimate ?? false,
          projectId: m.project ? project.id : null,
          note: m.note ?? null,
          isDemo: true,
          createdById: m.by ?? (m.type === 'entree' ? m.to! : admin.id),
          createdAt: daysAgo(m.ago),
        })),
      })

      // Validated bilan after the caravan: same rule as the app (gapOutcome).
      const counted: Record<string, number> = {
        [`Gants nitrile (taille M):${B}`]: 3,
        [`Gobelets:${B}`]: 5,
        [`Compresses stériles:${C}`]: 12,
        [`Carpules d'anesthésie:${C}`]: 2.5,
        [`Aiguilles dentaires courtes:${C}`]: 1,
        [`Champs opératoires:${D}`]: 4,
        [`Rouleaux salivaires:${D}`]: 3,
        [`Solution désinfectante:${A}`]: 1,
        [`Daviers incisives supérieures:${B}`]: 3,
        [`Précelles:${D}`]: 9,
        [`Curettes:${A}`]: 9,
      }
      const nameOf = Object.fromEntries(Object.entries(ids).map(([n, i]) => [i, n]))
      const category = Object.fromEntries(ITEMS.map((i) => [i.name, i.category]))
      const balances = await getBalances(tx, { itemIds: Object.values(ids) })
      const count = await tx.inventoryCount.create({
        data: {
          projectId: project.id,
          status: 'valide',
          notes: 'Comptage au retour de la caravane, au local.',
          isDemo: true,
          createdById: A,
          validatedById: admin.id,
          validatedAt: daysAgo(25),
          createdAt: daysAgo(26),
        },
      })
      for (const b of balances) {
        const name = nameOf[b.itemId]!
        const countedQty = new Decimal(counted[`${name}:${b.holderId}`] ?? b.qty.toNumber())
        const outcome = gapOutcome(category[name]!, countedQty, b.qty)
        await tx.inventoryCountLine.create({
          data: { countId: count.id, itemId: b.itemId, holderId: b.holderId, snapshotQty: b.qty, expectedQty: b.qty, countedQty, outcome },
        })
        if (outcome === 'ok') continue
        const gap = countedQty.minus(b.qty)
        await tx.inventoryMovement.create({
          data: {
            itemId: b.itemId,
            qty: gap.abs(),
            type: outcome,
            fromHolderId: outcome === 'ajustement' ? null : b.holderId,
            toHolderId: outcome === 'ajustement' ? b.holderId : null,
            projectId: project.id,
            countId: count.id,
            note: 'Bilan après caravane',
            isDemo: true,
            createdById: admin.id,
            createdAt: daysAgo(25),
          },
        })
      }

      // Checklist for the caravan (some lines covered, some partial, some missing).
      const needs: [string, number][] = [
        ['Gants nitrile (taille M)', 15],
        ['Masques chirurgicaux', 5],
        ['Compresses stériles', 40],
        ["Carpules d'anesthésie", 15],
        ['Aiguilles dentaires courtes', 6],
        ['Champs opératoires', 15],
        ['Autoclave', 1],
        ['Détartreur ultrasonique', 2],
        ['Turbine', 1],
        ['Syndesmotomes', 6],
        ['Daviers molaires inférieures', 6],
      ]
      await tx.inventoryNeed.createMany({ data: needs.map(([n, q]) => ({ projectId: project.id, itemId: id(n), qtyNeeded: new Decimal(q), isDemo: true })) })

      return { project: project.name, items: ITEMS.length, holders: holders.length }
    },
    { timeout: 60_000, maxWait: 10_000 },
  )
  console.log('Demo inventory loaded:', summary)
}

async function clear() {
  const deleted = await prisma.$transaction((tx) => clearInventoryDemo(tx), { timeout: 60_000, maxWait: 10_000 })
  console.log('Demo inventory removed:', deleted)
}

const cmd = process.argv[2]
const run = cmd === 'seed' ? seed : cmd === 'clear' ? clear : null
if (!run) {
  console.error('Usage: pnpm db:inventory-demo seed|clear')
  process.exit(1)
}
run()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
