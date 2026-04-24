import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  // 1. Secure Header Check
  const authHeader = req.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    );
  }

  const admin = createAdminClient()

  // 2. Fetch all queued items that are due
  const { data: items, error: fetchError } = await admin
    .from('email_digest_queue')
    .select('*')
    .lte('send_after', new Date().toISOString())
    .order('recipient_id')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // 3. Group by recipient
  const grouped: Record<string, typeof items> = {}
  for (const item of items) {
    if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
    grouped[item.recipient_id].push(item)
  }

  // 4. Check email prefs and send one digest per recipient
  const recipientIds = Object.keys(grouped)
  const { data: emailPrefs } = await admin
    .from('user_email_prefs')
    .select('user_id, email_enabled')
    .in('user_id', recipientIds)

  const prefMap: Record<string, boolean> = {}
  ;(emailPrefs || []).forEach((p: any) => { 
    prefMap[p.user_id] = p.email_enabled 
  })

  let sentCount = 0
  for (const [recipientId, actions] of Object.entries(grouped)) {
    // Only send if the user hasn't disabled emails
    if (prefMap[recipientId] === false) continue

    const first = actions[0]
    try {
      await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
      sentCount++
    } catch (err) {
      console.error(`Failed to send email to ${recipientId}:`, err)
    }
  }

  // 5. Delete processed items so they aren't sent again (only after attempting to send)
  const processedIds = items.map(i => i.id)
  await admin.from('email_digest_queue').delete().in('id', processedIds)

  return NextResponse.json({ 
    success: true,
    sent: sentCount, 
    processed: items.length 
  })
}