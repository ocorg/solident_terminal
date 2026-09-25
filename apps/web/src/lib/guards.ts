import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role } from '@solident/db'
import { auth } from './auth'

export const STAFF_ROLES = ['admin', 'treasurer', 'hr', 'media'] as const satisfies readonly Role[]

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** For pages: redirects to /connexion if logged out, to /acces-refuse if the role is not allowed. */
export async function requireRolePage(...roles: Role[]) {
  const session = await getSession()
  if (!session) redirect('/connexion')
  const role = session.user.role as Role
  if (!session.user.isActive || !roles.includes(role)) redirect('/acces-refuse')
  return { ...session, role }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireRole(...roles: Role[]) {
  const session = await getSession()
  if (!session) throw new Error('Non connecté')
  const role = session.user.role as Role
  if (!session.user.isActive || !roles.includes(role)) throw new Error('Accès refusé')
  return { ...session, role }
}
