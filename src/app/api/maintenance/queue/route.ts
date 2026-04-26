import { NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET — view all stuck queue items
export async function GET() {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_digest_queue')
    .select('*')
    .order('send_after', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// DELETE — force-process all queue items immediately, ignoring send_after
export async function DELETE() {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data: items, error } = await admin
    .from('email_digest_queue')
    .select('*')
    .order('recipient_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) return NextResponse.json({ sent: 0, message: 'Queue vide' })

  // Group by recipient (same logic as the cron route)
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
      errors.push(`${first.recipient_email}: ${err?.message}`)
    }
  }

  // Delete all processed items
  const processedIds = items.map(i => i.id)
  await admin.from('email_digest_queue').delete().in('id', processedIds)

  return NextResponse.json({
    success: true,
    sent:    sentCount,
    total:   items.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}