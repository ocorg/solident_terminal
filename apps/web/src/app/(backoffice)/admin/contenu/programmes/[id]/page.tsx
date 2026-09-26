import { notFound } from 'next/navigation'
import { prisma } from '@solident/db'
import { ImageField } from '@/components/admin/image-field'
import { requireRolePage } from '@/lib/guards'
import { ProgrammeForm } from '../../programme-form'

export default async function EditProgrammePage({ params }: PageProps<'/admin/contenu/programmes/[id]'>) {
  await requireRolePage('admin', 'media')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const p = await prisma.programme.findUnique({ where: { id } })
  if (!p) notFound()

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">{p.titleFr}</h1>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <p className="font-semibold text-navy-700">Image de couverture</p>
        <ImageField entity="programme" id={p.id} url={p.coverUrl} alt={p.titleFr} maxSide={1600} />
      </div>
      <ProgrammeForm
        initial={{
          id: p.id,
          titleFr: p.titleFr,
          titleAr: p.titleAr ?? '',
          titleEn: p.titleEn ?? '',
          summaryFr: p.summaryFr ?? '',
          summaryAr: p.summaryAr ?? '',
          summaryEn: p.summaryEn ?? '',
          bodyFr: p.bodyFr ?? '',
          bodyAr: p.bodyAr ?? '',
          bodyEn: p.bodyEn ?? '',
          order: p.order,
          isActive: p.isActive,
        }}
      />
    </div>
  )
}
