import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'
import { formatInTimeZone } from 'date-fns-tz'

// Set the runtime to Node.js (Vercel default)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 1. Secure Header Check
    const authHeader = req.headers.get('authorization');
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient()

    // 2. Get Precise Morocco Time
    // This creates an ISO string that matches the exact second in Morocco
    const now = new Date();
    const lookupTimestamp = formatInTimeZone(now, 'Africa/Casablanca', "yyyy-MM-dd'T'HH:mm:ssXXX");

    // 3. Fetch all queued items due in Morocco
    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', lookupTimestamp) 
      .order('recipient_id')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No pending emails to process', sent: 0 })
    }

    // 4. Group the queue items
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
      grouped[item.recipient_id].push(item)
    }

    // 5. Fetch user preferences
    const recipientIds = Object.keys(grouped)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs')
      .select('user_id, email_enabled')
      .in('user_id', recipientIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { 
      prefMap[p.user_id] = p.email_enabled 
    })

    // 6. Send emails
    let sentCount = 0
    for (const [recipientId, actions] of Object.entries(grouped)) {
      if (prefMap[recipientId] === false) continue

      const first = actions[0]
      try {
        await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
        sentCount++
      } catch (err) {
        console.error(`Failed to send email to ${recipientId}:`, err)
      }
    }

    // 7. Cleanup
    const processedIds = items.map(i => i.id)
    await admin.from('email_digest_queue').delete().in('id', processedIds)

    return NextResponse.json({ 
      success: true,
      sent: sentCount, 
      total_processed: items.length 
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}