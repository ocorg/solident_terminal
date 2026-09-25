import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — full system health snapshot
export async function GET() {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()

  // Run all health queries in parallel
  const [
    configRes,
    lastNotifRes,
    queueCountRes,
    oldestQueueRes,
    lastNotifSentRes,
    totalUsersRes,
  ] = await Promise.allSettled([
    admin.from('app_config').select('value').eq('key', 'maintenance_mode').single(),
    admin.from('notifications').select('created_at').order('created_at', { ascending: false }).limit(1).single(),
    admin.from('email_digest_queue').select('id', { count: 'exact', head: true }),
    admin.from('email_digest_queue').select('send_after, action_type, recipient_email').order('send_after', { ascending: true }).limit(1).single(),
    admin.from('notifications').select('created_at').order('created_at', { ascending: false }).limit(1),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  const maintenanceMode =
    configRes.status === 'fulfilled'
      ? (configRes.value.data?.value === 'true')
      : false

  const lastNotification =
    lastNotifRes.status === 'fulfilled' ? lastNotifRes.value.data?.created_at : null

  const queueCount =
    queueCountRes.status === 'fulfilled' ? (queueCountRes.value.count ?? 0) : 0

  const oldestQueued =
    oldestQueueRes.status === 'fulfilled' ? oldestQueueRes.value.data : null

  const totalUsers =
    totalUsersRes.status === 'fulfilled' ? (totalUsersRes.value.count ?? 0) : 0

  // Determine queue health
  let queueStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (queueCount > 0 && oldestQueued) {
    const ageMs = Date.now() - new Date(oldestQueued.send_after).getTime()
    const ageHours = ageMs / (1000 * 60 * 60)
    if (ageHours > 24) queueStatus = 'critical'
    else if (ageHours > 1) queueStatus = 'warning'
  }

  return NextResponse.json({
    maintenance_mode: maintenanceMode,
    health: {
      database:         'ok',
      total_users:      totalUsers,
      last_notification: lastNotification,
      email_queue: {
        count:        queueCount,
        status:       queueStatus,
        oldest_item:  oldestQueued,
      },
    },
    timestamp: new Date().toISOString(),
  })
}

// POST — toggle maintenance mode { enabled: boolean }
export async function POST(req: NextRequest) {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const { enabled } = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('app_config')
    .upsert({
      key:        'maintenance_mode',
      value:      enabled ? 'true' : 'false',
      updated_at: new Date().toISOString(),
      updated_by: auth.user!.id,
    }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ maintenance_mode: enabled })
}