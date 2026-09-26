'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { addManualDonation, decideDonation } from '@/lib/donations'
import { requireRole } from '@/lib/guards'
import { createPrivateViewUrl } from '@/lib/r2'

const MONEY_ROLES = ['admin', 'treasurer'] as const

export async function confirmDonation(input: { id: string }) {
  return run(async () => {
    const { user } = await requireRole(...MONEY_ROLES)
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const c = await decideDonation(id, 'confirmed', user.id)
    revalidatePath('/admin', 'layout')
    return ok({ raisedDh: c.raisedDh })
  }, 'La confirmation a échoué.')
}

export async function rejectDonation(input: { id: string; note?: string }) {
  return run(async () => {
    const { user } = await requireRole(...MONEY_ROLES)
    const { id, note } = z.object({ id: z.uuid(), note: z.string().trim().max(500).optional() }).parse(input)
    const c = await decideDonation(id, 'rejected', user.id, note ?? '')
    revalidatePath('/admin', 'layout')
    return ok({ raisedDh: c.raisedDh })
  }, 'Le refus a échoué.')
}

/** 5-minute link to the private receipt (spec §6: admin + treasurer only). */
export async function getProofLink(input: { id: string }) {
  return run(async () => {
    const { user } = await requireRole(...MONEY_ROLES)
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const d = await prisma.donation.findUnique({ where: { id }, select: { proofKey: true } })
    if (!d?.proofKey) return fail('Aucun justificatif pour ce don.')
    await prisma.auditLog.create({ data: { userId: user.id, action: 'donation.view_proof', entity: 'donation', entityId: id } })
    return ok({ url: await createPrivateViewUrl(d.proofKey, 300) })
  })
}

const manualSchema = z.object({
  campaignId: z.uuid(),
  amountDh: z.number().int().min(1).max(10_000_000),
  donorName: z.string().trim().max(120).optional(),
  partnerId: z.union([z.literal(''), z.uuid()]).optional(),
  showOnWall: z.boolean(),
  note: z.string().trim().max(500).optional(),
})

export async function addManual(input: z.input<typeof manualSchema>) {
  return run(async () => {
    const { user } = await requireRole(...MONEY_ROLES)
    const d = manualSchema.parse(input)
    if (!d.partnerId && d.showOnWall && !d.donorName) return fail('Indiquez un nom pour l’afficher sur le mur des donateurs.')
    const c = await addManualDonation({ ...d, partnerId: d.partnerId || undefined, isAnonymous: !d.showOnWall }, user.id)
    revalidatePath('/admin', 'layout')
    return ok({ raisedDh: c.raisedDh })
  }, 'L’ajout a échoué.')
}
