import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // FIX 1: use Cron_Key, not CRON_SECRET (CRON_SECRET does not exist in Vercel env)
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.Cron_Key}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // FIX 2: use now() as the cutoff, not now+61min.
    //
    // queueDigest() sets send_after = now + 1 minute.
    // Using now+61min means items are picked up on the very first cron tick
    // after insertion — before the 1-minute grouping window has closed.
    // This breaks digest grouping: a second action 30s later finds nothing
    // to group into because the first was already sent and deleted.
    //
    // Using now() means: only process items whose delay has elapsed.
    // The cron runs every minute, so the worst-case delay is ~2 minutes total.
    const now = new Date().toISOString()

    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', now)
      .order('recipient_id')

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!items || items.length === 0) return NextResponse.json({ sent: 0 })

    // Group all pending actions by recipient into one email per person
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
    for (const [recipientId, actions] of Object.entries(grouped)) {
      if (prefMap[recipientId] === false) continue
      const first = actions[0]
      try {
        await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
        sentCount++
      } catch (err) {
        console.error(`Email error for ${first.recipient_email}:`, err)
      }
    }

    // Delete all processed items (whether sent or opted-out)
    const processedIds = items.map((i: any) => i.id)
    await admin.from('email_digest_queue').delete().in('id', processedIds)

    return NextResponse.json({ success: true, sent: sentCount, total: items.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Internal Server Error' }, { status: 500 })
  }
}