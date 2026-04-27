import { NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * POST — manually trigger the email digest cron.
 *
 * WHY direct logic instead of HTTP self-call:
 * Calling fetch(NEXT_PUBLIC_APP_URL + '/api/cron/digest') is fragile:
 *  - the env var can point to the wrong project
 *  - adds a double-slash if the URL ends with /
 *  - the target route returns HTML on auth failure, breaking JSON.parse
 * Importing the logic directly is simpler, faster, and always correct.
 */
export async function POST() {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  try {
    const admin = createAdminClient()

    // Use a wide window so nothing is skipped (same +61m logic as the real cron)
    const lookupTimestamp = new Date(Date.now() + 61 * 60 * 1000).toISOString()

    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', lookupTimestamp)
      .order('recipient_id')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, sent: 0, total: 0, message: 'Queue vide' })
    }

    // Group by recipient
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
      grouped[item.recipient_id].push(item)
    }

    const recipientIds = Object.keys(grouped)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs')
      .select('user_id, email_enabled')
      .in('user_id', recipientIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

    let sentCount = 0
    const errors: string[] = []

    for (const [recipientId, actions] of Object.entries(grouped)) {
      if (prefMap[recipientId] === false) continue
      const first = actions[0]
      try {
        await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
        sentCount++
      } catch (err: any) {
        errors.push(`${first.recipient_email}: ${err?.message ?? 'unknown error'}`)
        console.error('Email error in cron-trigger:', err)
      }
    }

    // Delete all items that were picked up (processed or opted-out)
    const processedIds = items.map((i: any) => i.id)
    await admin.from('email_digest_queue').delete().in('id', processedIds)

    return NextResponse.json({
      success: true,
      sent:    sentCount,
      total:   items.length,
      errors:  errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Internal Server Error' }, { status: 500 })
  }
}