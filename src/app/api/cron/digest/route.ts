import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

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

    // 2. THE FIX: Look 65 minutes into the future
    // This solves the Morocco (+1h) offset and adds 5 mins of safety.
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60); 
    const lookupTimestamp = now.toISOString();

    // 3. Fetch all queued items (The query will now "see" the Morocco rows)
    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', lookupTimestamp) 
      .order('recipient_id')

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // If there is nothing to send, exit early
    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No pending emails found in the search window', sent: 0 })
    }

    // 4. Group the queue items by recipient
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
      grouped[item.recipient_id].push(item)
    }

    // 5. Fetch user email preferences
    const recipientIds = Object.keys(grouped)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs')
      .select('user_id, email_enabled')
      .in('user_id', recipientIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { 
      prefMap[p.user_id] = p.email_enabled 
    })

    // 6. Send one digest email per recipient
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

    // 7. Cleanup: Delete processed items
    const processedIds = items.map(i => i.id)
    await admin.from('email_digest_queue').delete().in('id', processedIds)

    return NextResponse.json({ 
      success: true,
      sent: sentCount, 
      total_processed: items.length,
      search_time_used: lookupTimestamp
    })

  } catch (error: any) {
    console.error('Global Cron Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}