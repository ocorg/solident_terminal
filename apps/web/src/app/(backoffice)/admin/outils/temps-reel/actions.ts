'use server'

import { requireRole } from '@/lib/guards'
import { broadcast } from '@/lib/pusher'
import { channels } from '@/lib/realtime'

export async function sendPing() {
  const { user } = await requireRole('admin')
  await broadcast(channels.test, 'ping', { sentAt: Date.now(), by: user.name })
  return { status: 'success' as const, data: null }
}
