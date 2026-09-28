/** Where a members-area notification leads, from its type and target id (list page + phone notifications). */
export function notificationLink(type: string, targetId: string | null | undefined) {
  if (!targetId) return null
  if (type.startsWith('task_')) return `/espace/taches/${targetId}`
  if (type === 'event_invited') return '/espace/evenements'
  if (type === 'proposal_approved') return `/espace/projets/${targetId}`
  if (type.startsWith('proposal_')) return '/espace/propositions'
  if (type === 'project_member_added') return `/espace/projets/${targetId}`
  if (type === 'cellule_member_added') return `/espace/cellules/${targetId}`
  return null
}
