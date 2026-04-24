import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient()

    // 61 MINUTES: 60 for Morocco (UTC+1) + 1 for your grouping logic
    const lookupTimestamp = new Date(Date.now() + 61 * 60 * 1000).toISOString();

    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', lookupTimestamp) 
      .order('recipient_id')

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!items || items.length === 0) return NextResponse.json({ sent: 0 })

    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
      grouped[item.recipient_id].push(item)
    }

    const recipientIds = Object.keys(grouped)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs')
      .select('user_id, email_enabled').in('user_id', recipientIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

    let sentCount = 0
    for (const [recipientId, actions] of Object.entries(grouped)) {
      if (prefMap[recipientId] === false) continue
      const first = actions[0]
      try {
        await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
        sentCount++
      } catch (err) { console.error(err) }
    }

    const processedIds = items.map(i => i.id)
    await admin.from('email_digest_queue').delete().in('id', processedIds)

    return NextResponse.json({ success: true, sent: sentCount })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}