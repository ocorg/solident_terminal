import type { Metadata } from 'next'
import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { ActionForm } from '../../action-form'

export const metadata: Metadata = { title: 'Nouvelle action' }

export default async function NewActionPage() {
  await requireRolePage('admin', 'media')
  const [programmes, partners] = await Promise.all([
    prisma.programme.findMany({ orderBy: { order: 'asc' }, select: { id: true, titleFr: true } }),
    prisma.partner.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-3xl font-bold text-navy-900">Nouvelle action<span className="brand-dot" aria-hidden /></h1>
      <ActionForm programmes={programmes.map((p) => ({ id: p.id, title: p.titleFr }))} partners={partners} />
    </div>
  )
}
