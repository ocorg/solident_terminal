import { notFound } from 'next/navigation'
import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { CampaignForm } from '../campaign-form'

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export default async function EditCampagnePage({ params }: PageProps<'/admin/campagnes/[id]'>) {
  await requireRolePage('admin', 'treasurer')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const c = await prisma.campaign.findUnique({ where: { id } })
  if (!c) notFound()

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">{c.titleFr}</h1>
      <p className="text-sm text-ink-600">
        Le total collecté ({new Intl.NumberFormat('fr-MA').format(c.raisedDh)} DH) se calcule automatiquement à partir des dons confirmés.
      </p>
      <CampaignForm
        initial={{
          id: c.id,
          slug: c.slug,
          titleFr: c.titleFr,
          titleAr: c.titleAr ?? '',
          titleEn: c.titleEn ?? '',
          summaryFr: c.summaryFr ?? '',
          summaryAr: c.summaryAr ?? '',
          summaryEn: c.summaryEn ?? '',
          goalDh: c.goalDh,
          startsOn: isoDay(c.startsOn),
          endsOn: isoDay(c.endsOn),
          isActive: c.isActive,
        }}
      />
    </div>
  )
}
