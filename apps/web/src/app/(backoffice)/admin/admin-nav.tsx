'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@solident/db'

// Screens per role (docs/SPEC.md §7). Pages enforce the same rule server-side with requireRolePage.
export const adminScreens: { href: string; label: string; roles: Role[] }[] = [
  { href: '/admin', label: 'Tableau de bord', roles: ['admin', 'treasurer', 'hr', 'media'] },
  { href: '/admin/dons', label: 'Dons', roles: ['admin', 'treasurer'] },
  { href: '/admin/campagnes', label: 'Campagnes', roles: ['admin', 'treasurer'] },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', roles: ['admin'] },
  { href: '/admin/outils/upload', label: 'Outils', roles: ['admin'] },
]

export function AdminNav({ role, badges }: { role: Role; badges: Record<string, number> }) {
  const pathname = usePathname()
  const items = adminScreens.filter((s) => s.roles.includes(role))
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href.replace(/\/upload$/, '')))

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-navy-100 bg-white px-4 sm:px-6" aria-label="Administration">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-semibold transition ${
            active(i.href) ? 'text-navy-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-gold-500' : 'text-ink-600 hover:text-navy-700'
          }`}
        >
          {i.label}
          {badges[i.href] > 0 && (
            <span className="rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-900">{badges[i.href]}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}
