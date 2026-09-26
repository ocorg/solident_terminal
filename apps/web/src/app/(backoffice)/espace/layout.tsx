import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@solident/db'
import { Logo } from '@/components/brand/logo'
import { SignOutButton } from '@/components/sign-out-button'
import { Avatar } from '@/components/space/avatar'
import { STAFF_ROLES } from '@/lib/guards'
import { requireMemberPage } from '@/lib/space'
import { SpaceNav } from './space-nav'

export const metadata: Metadata = { title: { default: 'Espace membres · Solident', template: '%s · Espace membres' } }

export default async function SpaceLayout({ children }: LayoutProps<'/espace'>) {
  const user = await requireMemberPage()
  const [unread, pendingProposals] = await Promise.all([
    prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
    user.isSpaceAdmin ? prisma.projectProposal.count({ where: { status: 'en_attente' } }) : 0,
  ])
  const isStaff = (STAFF_ROLES as readonly string[]).includes(user.role)

  return (
    <div className="flex flex-1 flex-col bg-cream-50">
      <header className="flex items-center justify-between gap-3 bg-navy-900 px-4 py-3 text-white sm:px-6">
        <Link href="/espace" className="flex items-center gap-2 font-heading text-lg font-bold">
          <Logo size={26} variant="badge" />
          Solident<span className="text-gold-500">.</span> <span className="font-normal opacity-80">espace membres</span>
        </Link>
        <div className="flex items-center gap-3">
          {isStaff && (
            <Link href="/admin" className="hidden rounded-[10px] bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 sm:inline">
              Administration
            </Link>
          )}
          <Link href="/fr" className="hidden text-sm opacity-80 hover:opacity-100 md:inline">
            Site ↗
          </Link>
          <Link href="/espace/parametres" className="flex items-center gap-2">
            <Avatar name={user.name} image={user.image} size="sm" />
            <span className="hidden text-sm lg:inline">{user.name}</span>
          </Link>
          <SignOutButton className="border-white/30 hover:bg-white/10" />
        </div>
      </header>
      <SpaceNav unread={unread} pendingProposals={pendingProposals} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
