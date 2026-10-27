import { prisma } from '@solident/db'
import { PageHeader } from '@/components/ui/blocks'
import { notificationLink } from '@/lib/notification-links'
import { requireMemberPage } from '@/lib/space'
import { NotificationList } from './notification-list'

export const metadata = { title: 'Notifications' }

const icon = (type: string) =>
  type === 'task_assigned' ? '📌' : type === 'task_comment' ? '💬' : type.startsWith('task_') ? '🔄' : type === 'event_invited' ? '📅' : type.startsWith('proposal_') ? '💡' : '👥'

export default async function NotificationsPage() {
  const user = await requireMemberPage()
  const items = await prisma.notification.findMany({ where: { recipientId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 })
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" description="Tâches, invitations, transferts de matériel : ce qui vous concerne." />
      <NotificationList
        items={items.map((n) => ({
          id: n.id,
          message: n.message,
          href: notificationLink(n.type, n.targetId),
          read: !!n.readAt,
          icon: icon(n.type),
          when: n.createdAt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }),
        }))}
      />
    </div>
  )
}
