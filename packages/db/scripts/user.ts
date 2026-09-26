// Manage members until /admin/utilisateurs exists (Phase 1).
//   pnpm db:user list                         → all users (pending first)
//   pnpm db:user approve <email> [role]       → activate, optionally set role (admin|treasurer|hr|media|member)
//   pnpm db:user role <email> <role>          → change role
//   pnpm db:user deactivate <email>           → block login and end all sessions
import '../load-env'
import { prisma, type Role } from '../src/index'

const ROLES: Role[] = ['admin', 'treasurer', 'hr', 'media', 'member']
const [cmd, rawEmail, rawRole] = process.argv.slice(2)
const email = rawEmail?.trim().toLowerCase()

function parseRole(r: string | undefined): Role | undefined {
  if (r === undefined) return undefined
  if (!ROLES.includes(r as Role)) throw new Error(`Unknown role "${r}". Use one of: ${ROLES.join(', ')}`)
  return r as Role
}

async function mustFind(email: string | undefined) {
  if (!email) throw new Error('Missing email')
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`No user with email ${email}`)
  return user
}

async function main() {
  switch (cmd) {
    case 'list': {
      const users = await prisma.user.findMany({ orderBy: [{ isActive: 'asc' }, { createdAt: 'desc' }] })
      console.table(users.map((u) => ({ email: u.email, name: u.name, role: u.role, active: u.isActive, since: u.createdAt.toISOString().slice(0, 10) })))
      break
    }
    case 'approve': {
      const role = parseRole(rawRole)
      await mustFind(email)
      const u = await prisma.user.update({ where: { email }, data: { isActive: true, ...(role && { role }) } })
      console.log(`✔ ${u.email} is active (role: ${u.role})`)
      break
    }
    case 'role': {
      const role = parseRole(rawRole)
      if (!role) throw new Error('Missing role')
      await mustFind(email)
      const u = await prisma.user.update({ where: { email }, data: { role } })
      console.log(`✔ ${u.email} is now ${u.role}`)
      break
    }
    case 'deactivate': {
      const user = await mustFind(email)
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { isActive: false } }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
      ])
      console.log(`✔ ${user.email} deactivated and logged out everywhere`)
      break
    }
    default:
      console.log('Usage: pnpm db:user list | approve <email> [role] | role <email> <role> | deactivate <email>')
  }
}

main()
  .catch((e) => {
    console.error('✖', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
