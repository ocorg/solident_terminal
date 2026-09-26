import type { Role } from '@solident/db'

// Shared by the server page and the client row actions.
export const roleOptions: { value: Role; label: string }[] = [
  { value: 'member', label: 'Membre (pas d’accès admin)' },
  { value: 'media', label: 'Médias' },
  { value: 'hr', label: 'Ressources humaines' },
  { value: 'treasurer', label: 'Trésorerie' },
  { value: 'admin', label: 'Admin' },
]
