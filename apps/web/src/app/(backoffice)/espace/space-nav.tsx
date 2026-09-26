'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/espace', label: 'Tableau de bord' },
  { href: '/espace/taches', label: 'Tâches' },
  { href: '/espace/projets', label: 'Projets' },
  { href: '/espace/cellules', label: 'Cellules' },
  { href: '/espace/evenements', label: 'Agenda' },
  { href: '/espace/propositions', label: 'Propositions' },
  { href: '/espace/membres', label: 'Membres' },
  { href: '/espace/notifications', label: 'Notifications' },
  { href: '/espace/parametres', label: 'Paramètres' },
]

export function SpaceNav({ unread, pendingProposals }: { unread: number; pendingProposals: number }) {
  const pathname = usePathname()
  const badges: Record<string, number> = { '/espace/notifications': unread, '/espace/propositions': pendingProposals }
  const active = (href: string) => (href === '/espace' ? pathname === '/espace' : pathname.startsWith(href))
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-navy-100 bg-white px-4 sm:px-6" aria-label="Espace membres">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-semibold transition ${
            active(i.href) ? 'text-navy-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-gold-500' : 'text-ink-600 hover:text-navy-700'
          }`}
        >
          {i.label}
          {badges[i.href] > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-900">{badges[i.href]}</span>}
        </Link>
      ))}
    </nav>
  )
}
