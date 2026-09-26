import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@solident/db'
import { ImageField } from '@/components/admin/image-field'
import { requireRolePage } from '@/lib/guards'
import { dateToLocalInput } from '@/lib/tz'
import { EventForm } from '../event-form'

export default async function EditEventPage({ params }: PageProps<'/admin/evenements/[id]'>) {
  await requireRolePage('admin', 'media')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [e, programmes] = await Promise.all([
    prisma.event.findUnique({ where: { id } }),
    prisma.programme.findMany({ orderBy: { order: 'asc' }, select: { id: true, titleFr: true } }),
  ])
  if (!e) notFound()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">{e.titleFr}</h1>
        {e.isPublished && (
          <Link href={`/fr/evenements/${e.slug}`} target="_blank" className="text-sm font-semibold text-navy-700 underline">
            Voir sur le site ↗
          </Link>
        )}
      </div>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <p className="font-semibold text-navy-700">Image de couverture</p>
        <ImageField entity="event" id={e.id} url={e.coverUrl} alt={e.titleFr} />
        <p className="text-xs text-ink-600">Format paysage conseillé. Sans image, une couleur selon le type s’affiche. Floutez les visages d’enfants avant l’envoi.</p>
      </div>
      <EventForm
        programmes={programmes.map((p) => ({ id: p.id, title: p.titleFr }))}
        initial={{
          id: e.id,
          slug: e.slug,
          type: e.type,
          programmeId: e.programmeId ?? '',
          titleFr: e.titleFr,
          titleAr: e.titleAr ?? '',
          titleEn: e.titleEn ?? '',
          bodyFr: e.bodyFr ?? '',
          bodyAr: e.bodyAr ?? '',
          bodyEn: e.bodyEn ?? '',
          startsAt: dateToLocalInput(e.startsAt),
          endsAt: e.endsAt ? dateToLocalInput(e.endsAt) : '',
          location: e.location ?? '',
          capacity: e.capacity ?? '',
          registrationOpen: e.registrationOpen,
          isPublished: e.isPublished,
        }}
      />
    </div>
  )
}
