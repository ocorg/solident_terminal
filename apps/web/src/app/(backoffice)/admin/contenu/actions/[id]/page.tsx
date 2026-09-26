import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@solident/db'
import { ImageField } from '@/components/admin/image-field'
import { requireRolePage } from '@/lib/guards'
import { ActionForm } from '../../action-form'
import { GalleryManager } from '../../gallery-manager'

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export default async function EditActionPage({ params }: PageProps<'/admin/contenu/actions/[id]'>) {
  await requireRolePage('admin', 'media')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [a, programmes, partners, photos] = await Promise.all([
    prisma.action.findUnique({ where: { id }, include: { partners: { select: { partnerId: true } } } }),
    prisma.programme.findMany({ orderBy: { order: 'asc' }, select: { id: true, titleFr: true } }),
    prisma.partner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.media.findMany({ where: { ownerType: 'action', ownerId: id }, orderBy: { order: 'asc' }, select: { id: true, url: true } }),
  ])
  if (!a) notFound()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">{a.titleFr}</h1>
        {a.isPublished && (
          <Link href={`/fr/actions/${a.slug}`} target="_blank" className="text-sm font-semibold text-navy-700 underline">
            Voir sur le site ↗
          </Link>
        )}
      </div>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <p className="font-semibold text-navy-700">Image de couverture</p>
        <ImageField entity="action" id={a.id} url={a.coverUrl} alt={a.titleFr} maxSide={1600} />
      </div>
      <GalleryManager actionId={a.id} photos={photos} />
      <ActionForm
        programmes={programmes.map((p) => ({ id: p.id, title: p.titleFr }))}
        partners={partners}
        initial={{
          id: a.id,
          slug: a.slug,
          programmeId: a.programmeId ?? '',
          titleFr: a.titleFr,
          titleAr: a.titleAr ?? '',
          titleEn: a.titleEn ?? '',
          bodyFr: a.bodyFr ?? '',
          bodyAr: a.bodyAr ?? '',
          bodyEn: a.bodyEn ?? '',
          dateStart: isoDay(a.dateStart),
          dateEnd: isoDay(a.dateEnd),
          location: a.location ?? '',
          coords: a.lat !== null && a.lng !== null ? `${a.lat}, ${a.lng}` : '',
          beneficiariesCount: a.beneficiariesCount ?? '',
          partnerIds: a.partners.map((p) => p.partnerId),
          figures: Array.isArray(a.figures) ? (a.figures as { value: number; labelFr: string; labelAr?: string | null; labelEn?: string | null }[]).map((x) => ({ value: x.value, labelFr: x.labelFr, labelAr: x.labelAr ?? '', labelEn: x.labelEn ?? '' })) : [],
          isPublished: a.isPublished,
        }}
      />
    </div>
  )
}
