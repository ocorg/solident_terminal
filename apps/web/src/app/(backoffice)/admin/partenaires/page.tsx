import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { PartnerList } from './partner-list'

export default async function PartenairesPage() {
  await requireRolePage('admin', 'media')
  const partners = await prisma.partner.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { donations: { where: { status: 'confirmed' } }, actions: true } } },
  })

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Partenaires</h1>
      <p className="text-sm text-ink-600">
        Logos : de préférence PNG ou WebP à fond transparent. Ils sont réduits automatiquement. Un partenaire masqué n’apparaît plus sur le site (ni sur
        le mur des sponsors) mais son historique est conservé.
      </p>
      <PartnerList
        partners={partners.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          website: p.website ?? '',
          isVisible: p.isVisible,
          order: p.order,
          logoUrl: p.logoUrl,
          donations: p._count.donations,
          actions: p._count.actions,
        }))}
      />
    </div>
  )
}
