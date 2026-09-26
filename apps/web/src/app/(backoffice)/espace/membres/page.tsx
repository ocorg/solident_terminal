import Link from 'next/link'
import { prisma } from '@solident/db'
import { Avatar } from '@/components/space/avatar'
import { requireMemberPage } from '@/lib/space'
import { isManagementPosition } from '@/lib/space-labels'

export const metadata = { title: 'Membres' }

export default async function MembersPage({ searchParams }: PageProps<'/espace/membres'>) {
  const user = await requireMemberPage()
  const q = String((await searchParams).q ?? '').trim()
  const members = await prisma.user.findMany({
    where: { isActive: true, ...(q && { OR: [{ name: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] }) },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, username: true, email: true, image: true, role: true, spaceAdmin: true,
      projectMemberships: { select: { project: { select: { id: true, name: true } }, position: { select: { name: true } } } },
      celluleMemberships: { select: { cellule: { select: { id: true, name: true } }, position: { select: { name: true } } } },
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Membres ({members.length})</h1>
        <form action="/espace/membres" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Chercher un membre…" className="rounded-[10px] border border-navy-100 bg-white px-3 py-2 text-sm" />
          <button type="submit" className="btn btn-ghost px-3 py-2 text-sm">
            Chercher
          </button>
        </form>
      </div>
      {user.isSpaceAdmin && (
        <p className="rounded-[10px] bg-gold-100 px-4 py-3 text-sm text-navy-900">
          Pour ajouter quelqu’un : il ou elle crée un compte sur <strong>/inscription</strong>, puis un administrateur du site le valide dans Administration → Utilisateurs.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <li key={m.id} className="card flex min-w-0 gap-4 p-4">
            <Avatar name={m.name} image={m.image} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {m.name}
                {(m.role === 'admin' || m.spaceAdmin) && <span className="ms-2 rounded-full bg-navy-700 px-2 py-0.5 text-xs text-white">admin</span>}
              </p>
              <p className="truncate text-xs text-ink-600">
                {m.username && `@${m.username} · `}
                <a href={`mailto:${m.email}`} className="hover:underline">
                  {m.email}
                </a>
              </p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {m.projectMemberships.map((pm) => (
                  <li key={pm.project.id}>
                    <Link href={`/espace/projets/${pm.project.id}`} className={`rounded-full px-2 py-0.5 text-xs ${isManagementPosition(pm.position.name) ? 'bg-gold-100 font-semibold text-navy-900' : 'bg-navy-100 text-navy-700'}`}>
                      {pm.project.name}
                    </Link>
                  </li>
                ))}
                {m.celluleMemberships.map((cm) => (
                  <li key={cm.cellule.id}>
                    <Link href={`/espace/cellules/${cm.cellule.id}`} className={`rounded-full px-2 py-0.5 text-xs ${isManagementPosition(cm.position.name) ? 'bg-gold-100 font-semibold text-navy-900' : 'bg-solifun-sky/15 text-navy-700'}`}>
                      {cm.cellule.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
