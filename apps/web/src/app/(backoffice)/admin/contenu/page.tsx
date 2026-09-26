import Link from 'next/link'
import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'

const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function ContenuPage() {
  await requireRolePage('admin', 'media')
  const [programmes, actions, photoCounts] = await Promise.all([
    prisma.programme.findMany({ orderBy: { order: 'asc' }, include: { _count: { select: { actions: true } } } }),
    prisma.action.findMany({ orderBy: { dateStart: 'desc' }, include: { programme: { select: { titleFr: true, slug: true } }, _count: { select: { partners: true } } } }),
    prisma.media.groupBy({ by: ['ownerId'], where: { ownerType: 'action' }, _count: true }),
  ])
  const photos = new Map(photoCounts.map((p) => [p.ownerId, p._count]))
  const missingPins = actions.filter((a) => a.programme?.slug === 'caravanes' && a.lat === null).length

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Programmes</h1>
        <ul className="card divide-y divide-navy-100">
          {programmes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-48 flex-1">
                <p className="font-semibold">
                  {p.titleFr}
                  {!p.isActive && <span className="ms-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-ink-600">masqué</span>}
                </p>
                <p className="text-xs text-ink-600">
                  {p._count.actions} action{p._count.actions > 1 ? 's' : ''}
                  {!p.coverUrl && ' · sans image'}
                  {(!p.titleAr || !p.titleEn) && ' · traduction manquante'}
                </p>
              </div>
              <Link href={`/admin/contenu/programmes/${p.id}`} className="btn btn-ghost px-3 py-1.5 text-sm">
                Modifier
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold text-navy-700">Actions</h2>
          <Link href="/admin/contenu/actions/nouvelle" className="btn btn-primary">
            + Nouvelle action
          </Link>
        </div>
        {missingPins > 0 && (
          <p className="rounded-[10px] bg-gold-100 px-4 py-3 text-sm text-navy-900">
            {missingPins} caravane{missingPins > 1 ? 's' : ''} sans coordonnées : elles n’apparaissent pas encore sur la carte.
          </p>
        )}
        <ul className="card divide-y divide-navy-100">
          {actions.map((a) => (
            <li key={a.id} className={`flex flex-wrap items-center gap-4 p-4 ${a.isPublished ? '' : 'bg-cream-50'}`}>
              <div className="min-w-56 flex-1">
                <p className="font-semibold">
                  {a.titleFr}
                  {!a.isPublished && <span className="ms-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs text-navy-900">brouillon</span>}
                </p>
                <p className="text-xs text-ink-600">
                  {day(a.dateStart)} · {a.programme?.titleFr ?? 'sans programme'} · {photos.get(a.id) ?? 0} photo{(photos.get(a.id) ?? 0) > 1 ? 's' : ''}
                  {a.lat === null && ' · pas sur la carte'}
                </p>
              </div>
              <Link href={`/admin/contenu/actions/${a.id}`} className="btn btn-ghost px-3 py-1.5 text-sm">
                Modifier
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
