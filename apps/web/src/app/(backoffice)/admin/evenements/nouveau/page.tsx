import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { EventForm } from '../event-form'

export default async function NewEventPage() {
  await requireRolePage('admin', 'media')
  const programmes = await prisma.programme.findMany({ orderBy: { order: 'asc' }, select: { id: true, titleFr: true } })
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Nouvel événement</h1>
      <EventForm programmes={programmes.map((p) => ({ id: p.id, title: p.titleFr }))} />
    </div>
  )
}
