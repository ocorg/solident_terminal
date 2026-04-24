import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

// Set the runtime to Node.js (Vercel default)
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 1. Secure Header Check
    const authHeader = req.headers.get('authorization');
    
    // Validate the Bearer token against your CRON_SECRET environment variable
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron attempt rejected.');
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    const admin = createAdminClient()

    // 2. Fetch all queued items that are due for sending
    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', new Date().toISOString())
      .order('recipient_id')

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // If there is nothing to send, exit early with a 200
    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No pending emails to process', sent: 0 })
    }

    // 3. Group the queue items by recipient_id
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
      grouped[item.recipient_id].push(item)
    }

    // 4. Fetch user email preferences to respect "Opt-out" settings
    const recipientIds = Object.keys(grouped)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs')
      .select('user_id, email_enabled')
      .in('user_id', recipientIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { 
      prefMap[p.user_id] = p.email_enabled 
    })

    // 5. Send one digest email per recipient
    let sentCount = 0
    for (const [recipientId, actions] of Object.entries(grouped)) {
      // Skip if the user has explicitly disabled emails
      if (prefMap[recipientId] === false) continue

      const first = actions[0]
      try {
        await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
        sentCount++
      } catch (err) {
        console.error(`Failed to send email to ${recipientId}:`, err)
      }
    }

    // 6. Cleanup: Delete processed items so they don't send again on next run
    const processedIds = items.map(i => i.id)
    const { error: deleteError } = await admin
      .from('email_digest_queue')
      .delete()
      .in('id', processedIds)

    if (deleteError) {
      console.error('Cleanup error:', deleteError.message);
    }

    return NextResponse.json({ 
      success: true,
      sent: sentCount, 
      total_processed: items.length 
    })

  } catch (error: any) {
    console.error('Global Cron Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}