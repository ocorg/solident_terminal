import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch all queued items that are due
  const { data: items } = await admin
    .from('email_digest_queue')
    .select('*')
    .lte('send_after', new Date().toISOString())
    .order('recipient_id')

  if (!items || items.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // Group by recipient
  const grouped: Record<string, typeof items> = {}
  for (const item of items) {
    if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
    grouped[item.recipient_id].push(item)
  }

  // Check email prefs and send one digest per recipient
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
    await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
    sentCount++
  }

  // Delete processed items
  const processedIds = items.map(i => i.id)
  await admin.from('email_digest_queue').delete().in('id', processedIds)

  return NextResponse.json({ sent: sentCount, processed: items.length })
}