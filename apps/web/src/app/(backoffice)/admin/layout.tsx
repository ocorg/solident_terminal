import { SignOutButton } from '@/components/sign-out-button'
import { requireRolePage, STAFF_ROLES } from '@/lib/guards'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const { user, role } = await requireRolePage(...STAFF_ROLES)

  return (
    <div className="flex flex-1 flex-col bg-cream-50">
      <header className="flex items-center justify-between bg-navy-700 px-6 py-3 text-white">
        <span className="font-heading text-lg font-bold">
          Solident<span className="text-gold-500">.</span> <span className="font-normal opacity-80">admin</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm opacity-90 sm:inline">
            {user.name} · {role}
          </span>
          <SignOutButton className="border-white/30 hover:bg-white/10" />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
