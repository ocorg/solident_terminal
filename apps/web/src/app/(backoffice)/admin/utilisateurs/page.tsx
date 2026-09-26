import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { roleOptions } from './roles'
import { SpaceAdminToggle, UserRowActions } from './user-row-actions'

const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Casablanca' })

export default async function UtilisateursPage() {
  const { user: me } = await requireRolePage('admin')
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'asc' }, { createdAt: 'desc' }],
    include: { sessions: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
  })
  const pending = users.filter((u) => !u.isActive)
  const roleLabel = Object.fromEntries(roleOptions.map((o) => [o.value, o.label.replace(/ \(.*\)$/, '')]))

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Utilisateurs</h1>
      <p className="text-sm text-ink-600">
        Les inscriptions arrivent désactivées. Validez-les ici et choisissez un rôle : seuls Admin, Trésorerie, Ressources humaines et Médias ont accès à
        l’administration. Tout compte actif accède à l’espace membres ; « admin espace » y donne tous les droits (projets, cellules, tâches) sans accès à l’administration du site.
      </p>
      {pending.length > 0 && (
        <p className="rounded-[10px] bg-gold-100 px-4 py-3 text-sm font-semibold text-navy-900">
          {pending.length} compte{pending.length > 1 ? 's' : ''} en attente ou désactivé{pending.length > 1 ? 's' : ''}
        </p>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-navy-100 text-navy-900">
            <tr>
              {['Personne', 'Statut', 'Rôle actuel', 'Espace membres', 'Inscrit le', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-navy-100 align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold">
                    {u.name}
                    {u.id === me.id && <span className="ms-2 text-xs font-normal text-ink-600">(vous)</span>}
                  </div>
                  <div className="text-xs text-ink-600">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.isActive ? 'bg-success/15 text-success' : 'bg-gold-100 text-navy-900'}`}>
                    {u.isActive ? 'Actif' : 'En attente / désactivé'}
                  </span>
                  {u.sessions[0] && <div className="mt-1 text-xs text-ink-600">vu le {day(u.sessions[0].updatedAt)}</div>}
                </td>
                <td className="px-4 py-3">{roleLabel[u.role]}</td>
                <td className="px-4 py-3">{u.role === 'admin' ? <span className="text-sm text-ink-600">admin (inclus)</span> : <SpaceAdminToggle id={u.id} value={u.spaceAdmin} />}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-600">{day(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <UserRowActions id={u.id} isActive={u.isActive} role={u.role} isMe={u.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
