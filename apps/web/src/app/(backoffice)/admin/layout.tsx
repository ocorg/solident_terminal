import Link from 'next/link'
import { prisma } from '@solident/db'
import { Logo } from '@/components/brand/logo'
import { SignOutButton } from '@/components/sign-out-button'
import { requireRolePage, STAFF_ROLES } from '@/lib/guards'
import { AdminNav } from './admin-nav'

const roleLabel = { admin: 'Admin', treasurer: 'Trésorerie', hr: 'Ressources humaines', media: 'Médias', member: 'Membre' }

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { user, role } = await requireRolePage(...STAFF_ROLES)

  // Badges: work waiting for this role
  const [pendingDonations, pendingUsers, newMessages, newRegistrations, newVolunteers] = await Promise.all([
    role === 'admin' || role === 'treasurer' ? prisma.donation.count({ where: { status: 'pending' } }) : 0,
    role === 'admin' ? prisma.user.count({ where: { isActive: false } }) : 0,
    role === 'admin' ? prisma.inquiry.count({ where: { status: 'new' } }) : 0,
    role === 'admin' || role === 'hr' ? prisma.registration.count({ where: { status: 'new' } }) : 0,
    role === 'admin' || role === 'hr' ? prisma.volunteerApplication.count({ where: { status: 'new' } }) : 0,
  ])

  return (
    <div className="flex flex-1 flex-col bg-cream-50">
      <header className="flex items-center justify-between bg-navy-700 px-4 py-3 text-white sm:px-6">
        <Link href="/admin" className="flex min-w-0 items-center gap-2 whitespace-nowrap font-heading text-lg font-bold">
          <Logo size={26} variant="badge" />
          <span>
            Solident<span className="text-gold-500">.</span> <span className="font-normal opacity-80">admin</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/espace" className="hidden rounded-[10px] bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 md:inline">
            Espace membres
          </Link>
          <Link href="/fr" className="hidden text-sm opacity-80 hover:opacity-100 md:inline">
            Voir le site ↗
          </Link>
          <span className="hidden text-sm opacity-90 md:inline">
            {user.name} · {roleLabel[role]}
          </span>
          <SignOutButton compact className="border-white/30 hover:bg-white/10" />
        </div>
      </header>
      <AdminNav role={role} badges={{ '/admin/dons': pendingDonations, '/admin/utilisateurs': pendingUsers, '/admin/messages': newMessages, '/admin/inscriptions': newRegistrations, '/admin/benevoles': newVolunteers }} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
