import Link from 'next/link'
import { prisma } from '@solident/db'
import { AvatarStack } from '@/components/space/avatar'
import { requireMemberPage } from '@/lib/space'
import { ContextEditorToggle } from '../_lib/context-widgets'

export const metadata = { title: 'Cellules' }

export default async function CellulesPage() {
  const user = await requireMemberPage()
  const [cellules, open] = await Promise.all([
    prisma.cellule.findMany({ orderBy: { name: 'asc' }, include: { members: { include: { user: { select: { id: true, name: true, image: true } } } } } }),
    prisma.task.groupBy({ by: ['contextId'], where: { contextType: 'cellule', archived: false, status: { not: 'termine' } }, _count: true }),
  ])
  const openCount = (id: string) => open.find((o) => o.contextId === id)?._count ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Cellules</h1>
        {user.isSpaceAdmin && <ContextEditorToggle label="+ Nouvelle cellule" type="cellule" />}
      </div>
      {cellules.length === 0 && <p className="card p-6 text-ink-600">Aucune cellule.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cellules.map((c) => (
          <li key={c.id}>
            <Link href={`/espace/cellules/${c.id}`} className="card card-hover flex h-full flex-col overflow-hidden">
              <div className="relative h-28 bg-gradient-to-br from-solifun-sky to-navy-700">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="font-heading font-bold text-navy-900">{c.name}</p>
                {c.description && <p className="line-clamp-2 text-sm text-ink-600">{c.description}</p>}
                <div className="mt-auto flex items-center justify-between text-xs text-ink-600">
                  <span>
                    {c.members.length} membre{c.members.length > 1 ? 's' : ''} · {openCount(c.id)} tâche{openCount(c.id) > 1 ? 's' : ''} ouverte{openCount(c.id) > 1 ? 's' : ''}
                  </span>
                  <AvatarStack people={c.members.map((m) => m.user)} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
