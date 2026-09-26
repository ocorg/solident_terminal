'use client'

import type { Role } from '@solident/db'
import { BackofficeNav } from '@/components/backoffice-nav'

// Screens per role (docs/SPEC.md §7). Pages enforce the same rule server-side with requireRolePage.
export const adminScreens: { href: string; label: string; roles: Role[] }[] = [
  { href: '/admin', label: 'Tableau de bord', roles: ['admin', 'treasurer', 'hr', 'media'] },
  { href: '/admin/dons', label: 'Dons', roles: ['admin', 'treasurer'] },
  { href: '/admin/campagnes', label: 'Campagnes', roles: ['admin', 'treasurer'] },
  { href: '/admin/evenements', label: 'Événements', roles: ['admin', 'media', 'hr'] },
  { href: '/admin/inscriptions', label: 'Inscriptions', roles: ['admin', 'hr'] },
  { href: '/admin/benevoles', label: 'Bénévoles', roles: ['admin', 'hr'] },
  { href: '/admin/contenu', label: 'Contenu', roles: ['admin', 'media'] },
  { href: '/admin/equipe', label: 'Équipe', roles: ['admin', 'media'] },
  { href: '/admin/partenaires', label: 'Partenaires', roles: ['admin', 'media'] },
  { href: '/admin/documents', label: 'Documents', roles: ['admin', 'media'] },
  { href: '/admin/messages', label: 'Messages', roles: ['admin'] },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', roles: ['admin'] },
  { href: '/admin/outils/upload', label: 'Outils', roles: ['admin'] },
]

export function AdminNav({ role, badges }: { role: Role; badges: Record<string, number> }) {
  const items = adminScreens.filter((s) => s.roles.includes(role)).map((s) => ({ href: s.href, label: s.label, badge: badges[s.href] }))
  return (
    <BackofficeNav
      label="Administration"
      root="/admin"
      items={items}
      extra={[
        { href: '/espace', label: 'Espace membres' },
        { href: '/fr', label: 'Voir le site ↗' },
      ]}
    />
  )
}
