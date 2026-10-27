'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma, type InventoryLineOutcome, type Prisma } from '@solident/db'
import { clearInventoryDemo, Decimal, gapOutcome, getBalances, holderBalance, lockItems, totalsByItem } from '@solident/db/inventory'
import { fail, ok, run, type ActionResult } from '@/lib/action'
import { createUploadUrl, deleteObject, publicKeyFromUrl, publicUrl } from '@/lib/r2'
import { notify, requireMember, type SpaceUser } from '@/lib/space'
import { formatQty, movementLabel, normalizeQty } from './labels'
import { inventoryRights } from './rights'

// Inventory server actions. Every write: Zod validation, rights check, one transaction.
// Movements that take stock out lock the item first, then check the balance (no negative stock).

/** Expected user-facing error thrown from inside a transaction (rolls it back), returned as data. */
class InvError extends Error {}
const run2 = <T,>(body: () => Promise<ActionResult<T>>, fallback: string) =>
  run(async () => {
    try {
      return await body()
    } catch (e) {
      if (e instanceof InvError) return fail(e.message)
      throw e
    }
  }, fallback)

const TX = { timeout: 30_000, maxWait: 10_000 }

function refresh() {
  revalidatePath('/espace', 'layout')
}

// ───────── shared validation ─────────
const qty = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const s = normalizeQty(String(v))
    if (!s || Number(s) <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Quantité invalide' })
      return z.NEVER
    }
    return s
  })
const countedQty = z.union([z.string(), z.number(), z.null()]).transform((v, ctx) => {
  if (v === null || String(v).trim() === '') return null
  const s = normalizeQty(String(v))
  if (s === null) {
    ctx.addIssue({ code: 'custom', message: 'Quantité invalide' })
    return z.NEVER
  }
  return s
})
const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null)
const optId = z.union([z.literal(''), z.uuid()]).nullish().transform((v) => v || null)
const photoKey = z
  .string()
  .regex(/^espace\/inventory\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
  .nullish()
  .transform((v) => v ?? null)

const fmt = (d: Decimal) => formatQty(d.toString())

async function activeHolder(db: Prisma.TransactionClient | typeof prisma, id: string) {
  const u = await db.user.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } })
  if (!u) throw new InvError('Membre introuvable.')
  return u
}

async function liveItem(db: Prisma.TransactionClient | typeof prisma, id: string) {
  const item = await db.inventoryItem.findUnique({ where: { id } })
  if (!item || item.isDeleted) throw new InvError('Article introuvable ou archivé.')
  return item
}

async function projectOrNull(db: Prisma.TransactionClient | typeof prisma, id: string | null) {
  if (!id) return null
  const p = await db.project.findUnique({ where: { id }, select: { id: true, name: true, isDemo: true } })
  if (!p) throw new InvError('Projet introuvable.')
  return p
}

/** Refuses a movement that would take more than the holder has. Call after lockItems. */
async function assertEnough(tx: Prisma.TransactionClient, itemId: string, holderId: string, amount: Decimal, unit: string, itemName: string) {
  const balance = await holderBalance(tx, itemId, holderId)
  if (balance.lt(amount)) {
    const holder = await tx.user.findUnique({ where: { id: holderId }, select: { name: true } })
    throw new InvError(`Stock insuffisant : ${holder?.name ?? 'ce membre'} détient ${fmt(balance)} ${unit} de « ${itemName} » (demandé : ${fmt(amount)}).`)
  }
}

// ───────── catalogue ─────────
const itemSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(120),
  category: z.enum(['consommable', 'instrument', 'equipement']),
  subcategory: optText(80),
  unit: z.string().trim().min(1).max(30),
  minQty: z.union([z.literal(''), z.null(), qty]).optional().transform((v) => v || null),
  notes: optText(1000),
})

/** Any member can add an item (e.g. a new donation in the field); the catalogue team can edit it later. */
export async function createItem(input: z.input<typeof itemSchema> & { photoKey?: string | null }) {
  return run2(async () => {
    const user = await requireMember()
    const d = itemSchema.parse(input)
    const key = photoKey.parse(input.photoKey)
    const dup = await prisma.inventoryItem.findFirst({ where: { isDeleted: false, name: { equals: d.name, mode: 'insensitive' } }, select: { id: true } })
    if (dup) return fail(`Un article « ${d.name} » existe déjà dans le catalogue.`)
    const item = await prisma.inventoryItem.create({
      data: { ...d, minQty: d.minQty ? new Decimal(d.minQty) : null, photoUrl: key ? publicUrl(key) : null, createdById: user.id },
    })
    await prisma.auditLog.create({ data: { userId: user.id, action: 'inventory.item.create', entity: 'inventory_item', entityId: item.id, payload: { name: d.name } } })
    refresh()
    return ok({ id: item.id, name: item.name, unit: item.unit, category: item.category })
  }, 'L’article n’a pas pu être créé.')
}

export async function updateItem(input: z.input<typeof itemSchema> & { id: string }) {
  return run2(async () => {
    const user = await requireMember()
    if (!(await inventoryRights(user)).canManageCatalog) return fail('Action réservée à la cellule Logistique.')
    const id = z.uuid().parse(input.id)
    const d = itemSchema.parse(input)
    await liveItem(prisma, id)
    const dup = await prisma.inventoryItem.findFirst({ where: { isDeleted: false, id: { not: id }, name: { equals: d.name, mode: 'insensitive' } }, select: { id: true } })
    if (dup) return fail(`Un article « ${d.name} » existe déjà dans le catalogue.`)
    await prisma.inventoryItem.update({ where: { id }, data: { ...d, minQty: d.minQty ? new Decimal(d.minQty) : null } })
    await prisma.auditLog.create({ data: { userId: user.id, action: 'inventory.item.update', entity: 'inventory_item', entityId: id, payload: d } })
    refresh()
    return ok(null)
  }, 'L’article n’a pas pu être enregistré.')
}

/** Archive (soft delete) or restore. Archiving is refused while someone still holds the item. */
export async function setItemArchived(input: { id: string; archived: boolean }) {
  return run2(async () => {
    const user = await requireMember()
    if (!(await inventoryRights(user)).canManageCatalog) return fail('Action réservée à la cellule Logistique.')
    const d = z.object({ id: z.uuid(), archived: z.boolean() }).parse(input)
    const item = await prisma.inventoryItem.findUnique({ where: { id: d.id } })
    if (!item) return fail('Article introuvable.')
    if (d.archived) {
      const total = totalsByItem(await getBalances(prisma, { itemIds: [d.id] })).get(d.id)
      if (total && !total.isZero())
        return fail(`Impossible d’archiver : ${fmt(total)} ${item.unit} sont encore détenus. Enregistrez d’abord une consommation, une perte ou un transfert.`)
    }
    await prisma.inventoryItem.update({ where: { id: d.id }, data: { isDeleted: d.archived } })
    await prisma.auditLog.create({ data: { userId: user.id, action: d.archived ? 'inventory.item.archive' : 'inventory.item.restore', entity: 'inventory_item', entityId: d.id } })
    refresh()
    return ok(null)
  }, 'L’opération a échoué.')
}

export async function getItemPhotoUploadUrl(input: { contentType: string; size: number }) {
  return run(async () => {
    await requireMember()
    const d = z.object({ contentType: z.string().max(100), size: z.number().int() }).parse(input)
    const { key, uploadUrl } = await createUploadUrl({ bucket: 'public', kind: 'image', folder: 'espace/inventory', contentType: d.contentType, size: d.size })
    return ok({ key, uploadUrl })
  }, 'Photo refusée (type ou taille).')
}

/** Catalogue team, or the member who created the item. */
export async function setItemPhoto(input: { id: string; key: string | null }) {
  return run2(async () => {
    const user = await requireMember()
    const d = z.object({ id: z.uuid(), key: photoKey }).parse(input)
    const item = await liveItem(prisma, d.id)
    if (item.createdById !== user.id && !(await inventoryRights(user)).canManageCatalog) return fail('Action réservée à la cellule Logistique.')
    const url = d.key ? publicUrl(d.key) : null
    await prisma.inventoryItem.update({ where: { id: d.id }, data: { photoUrl: url } })
    const oldKey = publicKeyFromUrl(item.photoUrl)
    if (oldKey && item.photoUrl !== url) await deleteObject('public', oldKey).catch(() => {})
    refresh()
    return ok({ url })
  }, 'La photo n’a pas pu être enregistrée.')
}

// ───────── movements ─────────
const movementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('entree'), toHolderId: z.uuid(), source: z.enum(['don', 'achat', 'emprunt']) }),
  z.object({ type: z.literal('consommation'), fromHolderId: z.uuid() }),
  z.object({ type: z.literal('perte'), fromHolderId: z.uuid() }),
  z.object({ type: z.literal('transfert'), fromHolderId: z.uuid(), toHolderId: z.uuid() }),
])
const movementCommon = z.object({ itemId: z.uuid(), qty, isEstimate: z.boolean().optional().default(false), projectId: optId, note: optText(500) })
export type MovementInput = z.input<typeof movementSchema> & z.input<typeof movementCommon>

export async function recordMovement(input: MovementInput) {
  return run2(async () => {
    const user = await requireMember()
    const m = movementSchema.parse(input)
    const c = movementCommon.parse(input)
    const from = 'fromHolderId' in m ? m.fromHolderId : null
    const to = 'toHolderId' in m ? m.toHolderId : null
    const rights = await inventoryRights(user)

    if (m.type === 'entree' && to !== user.id && !rights.canMoveAny) return fail('Vous ne pouvez enregistrer une collecte que pour vous-même.')
    if (from && from !== user.id && !rights.canMoveAny) return fail('Vous ne pouvez déplacer que le matériel que vous détenez.')
    if (from && to && from === to) return fail('Choisissez un autre membre pour le transfert.')

    const result = await prisma.$transaction(async (tx) => {
      const item = await liveItem(tx, c.itemId)
      const project = await projectOrNull(tx, c.projectId)
      if (to) {
        const receiver = await activeHolder(tx, to)
        if (!receiver.isActive) throw new InvError(`${receiver.name} n’a pas de compte actif : choisissez un autre membre.`)
      }
      const amount = new Decimal(c.qty)
      await lockItems(tx, [item.id])
      if (from) await assertEnough(tx, item.id, from, amount, item.unit, item.name)
      const mv = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          qty: amount,
          type: m.type,
          source: m.type === 'entree' ? m.source : null,
          fromHolderId: from,
          toHolderId: to,
          isEstimate: c.isEstimate,
          projectId: project?.id ?? null,
          note: c.note,
          isDemo: item.isDemo || !!project?.isDemo,
          createdById: user.id,
        },
      })
      return { id: mv.id, item }
    }, TX)

    // Tell the people whose stock changed, when someone else did it.
    const text = `${user.name} : ${movementLabel[m.type].toLowerCase()} de ${formatQty(c.qty, c.isEstimate)} ${result.item.unit} « ${result.item.name} »`
    if (m.type === 'transfert') await notify([to!, from!], 'inventory_transfer', text, result.item.id, user.id)
    else await notify([from ?? to!], 'inventory_movement', text, result.item.id, user.id)
    refresh()
    return ok({ id: result.id })
  }, 'Le mouvement n’a pas pu être enregistré.')
}

/** Writes the reverse movement (holders swapped) instead of editing; a movement can be undone once. */
export async function undoMovement(input: { id: string; reason?: string }) {
  return run2(async () => {
    const user = await requireMember()
    if (!(await inventoryRights(user)).canUndo) return fail('Action réservée à la cellule Logistique.')
    const d = z.object({ id: z.uuid(), reason: optText(300) }).parse(input)

    await prisma.$transaction(async (tx) => {
      const orig = await tx.inventoryMovement.findUnique({ where: { id: d.id }, include: { item: true, reversedBy: { select: { id: true } } } })
      if (!orig) throw new InvError('Mouvement introuvable.')
      if (orig.reversesId) throw new InvError('Une annulation ne peut pas être annulée : enregistrez un nouveau mouvement.')
      if (orig.reversedBy) throw new InvError('Ce mouvement a déjà été annulé.')
      await lockItems(tx, [orig.itemId])
      // The reverse takes the quantity back from whoever received it.
      if (orig.toHolderId) await assertEnough(tx, orig.itemId, orig.toHolderId, orig.qty, orig.item.unit, orig.item.name)
      const date = orig.createdAt.toLocaleDateString('fr-FR', { timeZone: 'Africa/Casablanca' })
      await tx.inventoryMovement.create({
        data: {
          itemId: orig.itemId,
          qty: orig.qty,
          type: orig.type,
          source: orig.source,
          fromHolderId: orig.toHolderId,
          toHolderId: orig.fromHolderId,
          isEstimate: orig.isEstimate,
          projectId: orig.projectId,
          reversesId: orig.id,
          note: `Annulation du mouvement du ${date}${d.reason ? ` : ${d.reason}` : ''}`,
          isDemo: orig.isDemo,
          createdById: user.id,
        },
      })
    }, TX)
    refresh()
    return ok(null)
  }, 'L’annulation a échoué.')
}

// ───────── counts (inventaires / bilans) ─────────
/** Starts a count (or returns the open draft of the same project): one line per non-zero balance. */
export async function createCount(input: { projectId?: string | null; notes?: string }) {
  return run2(async () => {
    const user = await requireMember()
    const d = z.object({ projectId: optId, notes: optText(1000) }).parse(input)
    if (!(await inventoryRights(user, d.projectId)).canManageProject)
      return fail(d.projectId ? 'Le bilan est lancé par les responsables du projet ou la Logistique.' : 'Les inventaires généraux sont lancés par la Logistique.')
    const id = await prisma.$transaction(async (tx) => {
      const project = await projectOrNull(tx, d.projectId)
      const open = await tx.inventoryCount.findFirst({ where: { projectId: d.projectId, status: 'brouillon' }, select: { id: true } })
      if (open) return open.id
      const items = await tx.inventoryItem.findMany({ where: { isDeleted: false }, select: { id: true } })
      const balances = await getBalances(tx, { itemIds: items.map((i) => i.id) })
      const count = await tx.inventoryCount.create({ data: { projectId: d.projectId, notes: d.notes, isDemo: !!project?.isDemo, createdById: user.id } })
      await tx.inventoryCountLine.createMany({
        data: balances.filter((b) => b.qty.isPositive()).map((b) => ({ countId: count.id, itemId: b.itemId, holderId: b.holderId, snapshotQty: b.qty })),
      })
      return count.id
    }, TX)
    refresh()
    return ok({ id })
  }, 'L’inventaire n’a pas pu être créé.')
}

async function draftOrThrow(countId: string) {
  const count = await prisma.inventoryCount.findUnique({ where: { id: countId } })
  if (!count) throw new InvError('Inventaire introuvable.')
  if (count.status !== 'brouillon') throw new InvError('Cet inventaire a déjà été validé : il ne peut plus être modifié.')
  return count
}

export async function addCountLine(input: { countId: string; itemId: string; holderId: string }) {
  return run2(async () => {
    await requireMember()
    const d = z.object({ countId: z.uuid(), itemId: z.uuid(), holderId: z.uuid() }).parse(input)
    await draftOrThrow(d.countId)
    await liveItem(prisma, d.itemId)
    await activeHolder(prisma, d.holderId)
    const exists = await prisma.inventoryCountLine.findUnique({ where: { countId_itemId_holderId: { countId: d.countId, itemId: d.itemId, holderId: d.holderId } } })
    if (exists) return fail('Cette ligne existe déjà dans l’inventaire.')
    const snapshotQty = await holderBalance(prisma, d.itemId, d.holderId)
    const line = await prisma.inventoryCountLine.create({ data: { countId: d.countId, itemId: d.itemId, holderId: d.holderId, snapshotQty } })
    refresh()
    return ok({ id: line.id, snapshotQty: snapshotQty.toString() })
  }, 'La ligne n’a pas pu être ajoutée.')
}

export async function removeCountLine(input: { lineId: string }) {
  return run2(async () => {
    const user = await requireMember()
    const lineId = z.uuid().parse(input.lineId)
    const line = await prisma.inventoryCountLine.findUnique({ where: { id: lineId }, include: { count: true } })
    if (!line) return ok(null) // already gone (e.g. a retried offline sync)
    await draftOrThrow(line.countId)
    if (line.count.createdById !== user.id && !(await inventoryRights(user, line.count.projectId)).canManageProject)
      return fail('Seuls l’auteur de l’inventaire et les responsables peuvent retirer une ligne.')
    await prisma.inventoryCountLine.delete({ where: { id: lineId } })
    refresh()
    return ok(null)
  }, 'La ligne n’a pas pu être retirée.')
}

/** Autosave (also used by the offline sync): idempotent, only lines of this draft are touched. */
export async function saveCountLines(input: { countId: string; lines: { id: string; countedQty: string | null; note?: string | null }[]; notes?: string | null }) {
  return run2(async () => {
    await requireMember()
    const d = z
      .object({
        countId: z.uuid(),
        lines: z.array(z.object({ id: z.uuid(), countedQty, note: optText(300) })).max(2000),
        notes: z.string().trim().max(1000).nullish(),
      })
      .parse(input)
    await draftOrThrow(d.countId)
    await prisma.$transaction(async (tx) => {
      for (const l of d.lines)
        await tx.inventoryCountLine.updateMany({
          where: { id: l.id, countId: d.countId },
          data: { countedQty: l.countedQty === null ? null : new Decimal(l.countedQty), note: l.note },
        })
      if (d.notes !== undefined) await tx.inventoryCount.update({ where: { id: d.countId }, data: { notes: d.notes || null } })
    }, TX)
    return ok({ savedAt: new Date().toISOString() })
  }, 'L’enregistrement a échoué.')
}

export async function deleteCountDraft(input: { countId: string }) {
  return run2(async () => {
    const user = await requireMember()
    const countId = z.uuid().parse(input.countId)
    const count = await draftOrThrow(countId)
    if (count.createdById !== user.id && !(await inventoryRights(user, count.projectId)).canManageProject)
      return fail('Seuls l’auteur de l’inventaire et les responsables peuvent le supprimer.')
    await prisma.inventoryCount.delete({ where: { id: countId } })
    refresh()
    return ok(null)
  }, 'La suppression a échoué.')
}

export type CountChange = { lineId: string; itemName: string; holderName: string; snapshotQty: string; currentQty: string }

/** Lines whose ledger balance moved since they were added (shown to the validator before confirming). */
export async function checkCountChanges(input: { countId: string }) {
  return run2(async () => {
    const user = await requireMember()
    const count = await draftOrThrow(z.uuid().parse(input.countId))
    if (!(await inventoryRights(user, count.projectId)).canManageProject) return fail('Validation réservée aux responsables du projet et à la Logistique.')
    return ok(await countChanges(prisma, count.id))
  }, 'La vérification a échoué.')
}

async function countChanges(db: Prisma.TransactionClient | typeof prisma, countId: string): Promise<CountChange[]> {
  // Only counted lines matter: uncounted ones are skipped at validation.
  const lines = await db.inventoryCountLine.findMany({ where: { countId, countedQty: { not: null } }, include: { item: { select: { name: true } }, holder: { select: { name: true } } } })
  const balances = await getBalances(db, { itemIds: [...new Set(lines.map((l) => l.itemId))] })
  const now = new Map(balances.map((b) => [`${b.itemId}:${b.holderId}`, b.qty]))
  return lines
    .map((l) => ({ l, cur: now.get(`${l.itemId}:${l.holderId}`) ?? new Decimal(0) }))
    .filter(({ l, cur }) => !cur.eq(l.snapshotQty))
    .map(({ l, cur }) => ({ lineId: l.id, itemName: l.item.name, holderName: l.holder.name, snapshotQty: l.snapshotQty.toString(), currentQty: cur.toString() }))
}

/**
 * Validation: recomputes every expected quantity from the ledger, writes one movement per gap
 * (consumed / lost / surplus) tagged with the count and project, then freezes the count.
 * If balances changed since the draft started and the validator has not seen it, nothing is written.
 */
export async function validateCount(input: { countId: string; acceptChanges: boolean; outcomes?: Record<string, 'consommation' | 'perte'> }) {
  return run2(async () => {
    const user = await requireMember()
    const d = z
      .object({ countId: z.uuid(), acceptChanges: z.boolean(), outcomes: z.record(z.uuid(), z.enum(['consommation', 'perte'])).optional().default({}) })
      .parse(input)
    const pre = await draftOrThrow(d.countId)
    if (!(await inventoryRights(user, pre.projectId)).canManageProject) return fail('Validation réservée aux responsables du projet et à la Logistique.')

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM inventory_counts WHERE id = ${d.countId}::uuid FOR UPDATE`
      const count = await tx.inventoryCount.findUniqueOrThrow({ where: { id: d.countId }, include: { lines: { include: { item: true } } } })
      if (count.status !== 'brouillon') throw new InvError('Cet inventaire a déjà été validé.')
      const counted = count.lines.filter((l) => l.countedQty !== null)
      if (!counted.length) throw new InvError('Aucune quantité comptée : saisissez au moins une ligne avant de valider.')

      await lockItems(tx, count.lines.map((l) => l.itemId))
      const changes = await countChanges(tx, count.id)
      if (changes.length && !d.acceptChanges) return { validated: false as const, changes }

      const balances = await getBalances(tx, { itemIds: [...new Set(count.lines.map((l) => l.itemId))] })
      const now = new Map(balances.map((b) => [`${b.itemId}:${b.holderId}`, b.qty]))
      const totals = { consommation: 0, perte: 0, ajustement: 0, ok: 0 }
      const movements: Prisma.InventoryMovementCreateManyInput[] = []

      for (const l of count.lines) {
        const expected = now.get(`${l.itemId}:${l.holderId}`) ?? new Decimal(0)
        let outcome: InventoryLineOutcome | null = null
        if (l.countedQty !== null) {
          outcome = gapOutcome(l.item.category, l.countedQty, expected)
          const override = d.outcomes[l.id]
          if (override && (outcome === 'consommation' || outcome === 'perte')) outcome = override
          totals[outcome]++
          if (outcome !== 'ok') {
            const surplus = outcome === 'ajustement'
            movements.push({
              itemId: l.itemId,
              qty: l.countedQty.minus(expected).abs(),
              type: outcome,
              fromHolderId: surplus ? null : l.holderId,
              toHolderId: surplus ? l.holderId : null,
              projectId: count.projectId,
              countId: count.id,
              note: l.note ? `Inventaire : ${l.note}` : 'Inventaire',
              isDemo: count.isDemo || l.item.isDemo,
              createdById: user.id,
            })
          }
        }
        await tx.inventoryCountLine.update({ where: { id: l.id }, data: { expectedQty: expected, outcome } })
      }
      if (movements.length) await tx.inventoryMovement.createMany({ data: movements })
      await tx.inventoryCount.update({ where: { id: count.id }, data: { status: 'valide', validatedById: user.id, validatedAt: new Date() } })
      await tx.auditLog.create({
        data: { userId: user.id, action: 'inventory.count.validate', entity: 'inventory_count', entityId: count.id, payload: { ...totals, uncounted: count.lines.length - counted.length, acceptedChanges: changes.length } },
      })
      return { validated: true as const, changes: [] as CountChange[] }
    }, TX)

    if (result.validated) refresh()
    return ok(result)
  }, 'La validation a échoué.')
}

// ───────── needs (besoins of a project) ─────────
async function assertProjectManager(user: SpaceUser, projectId: string) {
  if (!(await inventoryRights(user, projectId)).canManageProject) throw new InvError('Action réservée aux responsables du projet et à la Logistique.')
}

export async function setNeed(input: { projectId: string; itemId: string; qtyNeeded: string; note?: string | null }) {
  return run2(async () => {
    const user = await requireMember()
    const d = z.object({ projectId: z.uuid(), itemId: z.uuid(), qtyNeeded: qty, note: optText(300) }).parse(input)
    await assertProjectManager(user, d.projectId)
    const [project, item] = await Promise.all([projectOrNull(prisma, d.projectId), liveItem(prisma, d.itemId)])
    const data = { qtyNeeded: new Decimal(d.qtyNeeded), note: d.note }
    await prisma.inventoryNeed.upsert({
      where: { projectId_itemId: { projectId: d.projectId, itemId: d.itemId } },
      create: { ...data, projectId: d.projectId, itemId: d.itemId, isDemo: !!project?.isDemo || item.isDemo },
      update: data,
    })
    refresh()
    return ok(null)
  }, 'Le besoin n’a pas pu être enregistré.')
}

export async function removeNeed(input: { id: string }) {
  return run2(async () => {
    const user = await requireMember()
    const id = z.uuid().parse(input.id)
    const need = await prisma.inventoryNeed.findUnique({ where: { id } })
    if (!need) return ok(null)
    await assertProjectManager(user, need.projectId)
    await prisma.inventoryNeed.delete({ where: { id } })
    refresh()
    return ok(null)
  }, 'Le besoin n’a pas pu être retiré.')
}

/** Copies another project's needs list; lines already present are kept as they are. */
export async function copyNeeds(input: { fromProjectId: string; toProjectId: string }) {
  return run2(async () => {
    const user = await requireMember()
    const d = z.object({ fromProjectId: z.uuid(), toProjectId: z.uuid() }).parse(input)
    if (d.fromProjectId === d.toProjectId) return fail('Choisissez un autre projet.')
    await assertProjectManager(user, d.toProjectId)
    const target = await projectOrNull(prisma, d.toProjectId)
    const [source, existing] = await Promise.all([
      prisma.inventoryNeed.findMany({ where: { projectId: d.fromProjectId, item: { isDeleted: false } }, include: { item: { select: { isDemo: true } } } }),
      prisma.inventoryNeed.findMany({ where: { projectId: d.toProjectId }, select: { itemId: true } }),
    ])
    if (!source.length) return fail('Ce projet n’a pas de liste de besoins.')
    const have = new Set(existing.map((e) => e.itemId))
    const toAdd = source.filter((n) => !have.has(n.itemId))
    await prisma.inventoryNeed.createMany({
      data: toAdd.map((n) => ({ projectId: d.toProjectId, itemId: n.itemId, qtyNeeded: n.qtyNeeded, note: n.note, isDemo: !!target?.isDemo || n.item.isDemo })),
      skipDuplicates: true,
    })
    refresh()
    return ok({ added: toAdd.length, skipped: source.length - toAdd.length })
  }, 'La copie a échoué.')
}

// ───────── demo data ─────────
export async function clearDemoData() {
  return run2(async () => {
    const user = await requireMember()
    if (!(await inventoryRights(user)).canClearDemo) return fail('Action réservée aux administrateurs.')
    const deleted = await prisma.$transaction(async (tx) => {
      const r = await clearInventoryDemo(tx)
      await tx.auditLog.create({ data: { userId: user.id, action: 'inventory.demo.clear', entity: 'inventory', payload: r } })
      return r
    }, { timeout: 60_000, maxWait: 10_000 })
    refresh()
    return ok(deleted)
  }, 'La suppression des données de démonstration a échoué.')
}
