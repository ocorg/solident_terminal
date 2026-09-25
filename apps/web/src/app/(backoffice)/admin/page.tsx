import { requireRolePage, STAFF_ROLES } from '@/lib/guards'

export default async function AdminHome() {
  const { user, role } = await requireRolePage(...STAFF_ROLES)

  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-card">
      <h1 className="mb-2 font-heading text-2xl font-bold text-navy-700">Bonjour {user.name}</h1>
      <p className="text-ink-600">
        Connecté en tant que <strong>{user.email}</strong> avec le rôle <strong>{role}</strong>. Le tableau de bord
        arrive en Phase 1.
      </p>
    </div>
  )
}
