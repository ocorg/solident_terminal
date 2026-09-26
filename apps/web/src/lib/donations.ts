import 'server-only'
import { revalidatePath } from 'next/cache'
import { prisma, type Prisma } from '@solident/db'
import { broadcast } from './pusher'
import { channels } from './realtime'

type Tx = Prisma.TransactionClient

/** Recomputes the cached totals from confirmed donations (spec §5). Call inside the write transaction. */
export async function recalcCampaign(tx: Tx, campaignId: string) {
  // Row lock: concurrent confirmations wait here, so each sum sees the others' committed changes.
  await tx.$executeRaw`SELECT id FROM campaigns WHERE id = ${campaignId}::uuid FOR UPDATE`
  const agg = await tx.donation.aggregate({
    where: { campaignId, status: 'confirmed' },
    _sum: { amountDh: true },
    _count: true,
  })
  return tx.campaign.update({
    where: { id: campaignId },
    data: { raisedDh: agg._sum.amountDh ?? 0, donorsCount: agg._count },
    select: { id: true, raisedDh: true, donorsCount: true, goalDh: true },
  })
}

/** After the transaction commits: push the new total to open pages and refresh cached pages. */
export async function publishCampaign(c: { id: string; raisedDh: number; donorsCount: number; goalDh: number }) {
  try {
    await broadcast(channels.campaign(c.id), 'total-updated', { raisedDh: c.raisedDh, donorsCount: c.donorsCount, goalDh: c.goalDh })
  } catch (e) {
    console.error('Pusher broadcast failed (totals are saved anyway):', e)
  }
  try {
    revalidatePath('/[locale]', 'layout')
  } catch (e) {
    console.error('Cache refresh failed (totals are saved anyway):', e)
  }
}

export type DonationDecision = 'confirmed' | 'rejected'

/** Confirm or reject a pending donation, recalc the campaign and log it, all in one transaction. */
export async function decideDonation(id: string, decision: DonationDecision, userId: string, note?: string) {
  const campaign = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.findUnique({ where: { id } })
    if (!d) throw new Error('Don introuvable')
    if (d.status === decision) throw new Error('Déjà traité')
    await tx.donation.update({
      where: { id },
      data: {
        status: decision,
        confirmedById: userId,
        confirmedAt: new Date(),
        ...(note !== undefined && { adminNote: note || null }),
      },
    })
    await tx.auditLog.create({
      data: { userId, action: decision === 'confirmed' ? 'donation.confirm' : 'donation.reject', entity: 'donation', entityId: id, payload: { from: d.status, amountDh: d.amountDh, note } },
    })
    return recalcCampaign(tx, d.campaignId)
  })
  await publishCampaign(campaign)
  return campaign
}

/** Bank transfer seen on the statement without a declaration (spec §6), or a company sponsorship. */
export async function addManualDonation(
  input: { campaignId: string; amountDh: number; donorName?: string; partnerId?: string; isAnonymous: boolean; note?: string },
  userId: string,
) {
  const campaign = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.create({
      data: {
        campaignId: input.campaignId,
        amountDh: input.amountDh,
        donorName: input.donorName || null,
        partnerId: input.partnerId || null,
        isAnonymous: input.isAnonymous,
        adminNote: input.note || null,
        source: 'manual',
        status: 'confirmed',
        confirmedById: userId,
        confirmedAt: new Date(),
      },
    })
    await tx.auditLog.create({
      data: { userId, action: 'donation.add_manual', entity: 'donation', entityId: d.id, payload: { amountDh: d.amountDh, partnerId: d.partnerId } },
    })
    return recalcCampaign(tx, input.campaignId)
  })
  await publishCampaign(campaign)
  return campaign
}

/** Individual donors who opted in: names only, never amounts (decision 26 Sep). */
export async function donorWall(campaignId: string, take = 60) {
  const rows = await prisma.donation.findMany({
    where: { campaignId, status: 'confirmed', isAnonymous: false, partnerId: null, donorName: { not: null } },
    orderBy: { confirmedAt: 'desc' },
    select: { donorName: true },
    take,
  })
  return rows.map((r) => r.donorName!.trim()).filter(Boolean)
}

/** Companies grouped by tier; a tier is earned when the partner's confirmed total reaches its minimum. */
export async function sponsorWall(campaignId?: string) {
  const [sums, tiers] = await Promise.all([
    prisma.donation.groupBy({
      by: ['partnerId'],
      where: { status: 'confirmed', partnerId: { not: null }, ...(campaignId && { campaignId }) },
      _sum: { amountDh: true },
    }),
    prisma.sponsorTier.findMany({ orderBy: { minDh: 'desc' } }),
  ])
  const partners = await prisma.partner.findMany({
    where: { id: { in: sums.map((s) => s.partnerId!) }, isVisible: true },
    select: { id: true, name: true, logoUrl: true, website: true },
  })
  const byId = new Map(partners.map((p) => [p.id, p]))
  const groups = tiers.map((t) => ({ tier: t, partners: [] as typeof partners }))
  const supporters: typeof partners = []
  for (const s of sums.sort((a, b) => (b._sum.amountDh ?? 0) - (a._sum.amountDh ?? 0))) {
    const p = byId.get(s.partnerId!)
    if (!p) continue
    const g = groups.find((g) => (s._sum.amountDh ?? 0) >= g.tier.minDh)
    ;(g ? g.partners : supporters).push(p)
  }
  return { tiers: groups.filter((g) => g.partners.length), supporters }
}
