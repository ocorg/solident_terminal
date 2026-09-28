import 'server-only'
import webpush from 'web-push'
import { prisma } from '@solident/db'

// Phone / browser notifications (Web Push). Devices subscribe in /espace/parametres (push_subscriptions).
// Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT. Missing keys = push silently off.
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
export const pushEnabled = Boolean(publicKey && privateKey)
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:solidentassociation@gmail.com', publicKey!, privateKey!)

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

/** Sends to every device of these users. Never throws; removes subscriptions the browser has revoked. */
export async function sendPush(userIds: string[], payload: PushPayload) {
  if (!pushEnabled || !userIds.length) return { sent: 0 }
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds }, user: { isActive: true } } })
  const body = JSON.stringify(payload)
  let sent = 0
  const gone: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 24 * 3600, urgency: 'normal' })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(s.id)
        else console.error('Push failed:', status ?? e)
      }
    }),
  )
  if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } })
  return { sent }
}
