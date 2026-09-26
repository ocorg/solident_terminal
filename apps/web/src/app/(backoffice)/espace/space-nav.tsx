'use client'

import { BackofficeNav } from '@/components/backoffice-nav'

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

export function SpaceNav({ unread, pendingProposals, isStaff }: { unread: number; pendingProposals: number; isStaff: boolean }) {
  const badges: Record<string, number> = { '/espace/notifications': unread, '/espace/propositions': pendingProposals }
  return (
    <BackofficeNav
      label="Espace membres"
      root="/espace"
      items={items.map((i) => ({ ...i, badge: badges[i.href] }))}
      extra={[...(isStaff ? [{ href: '/admin', label: 'Administration' }] : []), { href: '/fr', label: 'Voir le site ↗' }]}
    />
  )
}
