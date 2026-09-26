import { prisma } from '@solident/db'
import { requireMemberPage } from '@/lib/space'
import { NotificationList } from './notification-list'

export const metadata = { title: 'Notifications' }

/** Where a notification leads, from its type and target id. */
function link(type: string, targetId: string | null) {
  if (!targetId) return null
  if (type.startsWith('task_')) return `/espace/taches/${targetId}`
  if (type === 'event_invited') return '/espace/evenements'
  if (type === 'proposal_approved') return `/espace/projets/${targetId}`
  if (type.startsWith('proposal_')) return '/espace/propositions'
  if (type === 'project_member_added') return `/espace/projets/${targetId}`
  if (type === 'cellule_member_added') return `/espace/cellules/${targetId}`
  return null
}
const icon = (type: string) =>
  type === 'task_assigned' ? '📌' : type === 'task_comment' ? '💬' : type.startsWith('task_') ? '🔄' : type === 'event_invited' ? '📅' : type.startsWith('proposal_') ? '💡' : '👥'

export default async function NotificationsPage() {
  const user = await requireMemberPage()
  const items = await prisma.notification.findMany({ where: { recipientId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 })
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Notifications</h1>
      <NotificationList
        items={items.map((n) => ({
          id: n.id,
          message: n.message,
          href: link(n.type, n.targetId),
          read: !!n.readAt,
          icon: icon(n.type),
          when: n.createdAt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }),
        }))}
      />
    </div>
  )
}
