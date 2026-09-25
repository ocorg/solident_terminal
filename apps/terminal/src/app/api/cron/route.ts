import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.Cron_Key

    // ── Auth Guard ──────────────────────────────────────────────────────────
    // Log every auth failure so it's visible in Vercel Logs.
    // This is the most common silent failure point for external cron services.
    if (!expectedToken) {
      console.error('[CRON] ❌ Cron_Key environment variable is not set in Vercel.')
      return NextResponse.json(
        { error: 'Server misconfiguration: missing Cron_Key' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn(
        '[CRON] ❌ Unauthorized request.',
        `Received: "${authHeader ?? 'NO HEADER'}"`,
        `Expected: "Bearer <Cron_Key>"`
      )
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] ✅ Auth passed. Starting digest processing...')
    // ────────────────────────────────────────────────────────────────────────

    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { data: items, error: fetchError } = await admin
      .from('email_digest_queue')
      .select('*')
      .lte('send_after', now)
      .order('recipient_id')

    if (fetchError) {
      console.error('[CRON] ❌ Failed to fetch queue:', fetchError.message)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      console.log('[CRON] ℹ️ Queue is empty. Nothing to send.')
      return NextResponse.json({ sent: 0 })
    }

    console.log(`[CRON] 📬 Found ${items.length} item(s) in queue. Grouping by recipient...`)

    // Group all pending actions by recipient into one email per person
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      if (!grouped[item.recipient_id]) grouped[item.recipient_id] = []
      grouped[item.recipient_id].push(item)
    }

    const recipientIds = Object.keys(grouped)
    console.log(`[CRON] 👥 ${recipientIds.length} unique recipient(s) to process.`)

    const { data: emailPrefs } = await admin
      .from('user_email_prefs')
      .select('user_id, email_enabled')
      .in('user_id', recipientIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

    let sentCount = 0
    let skippedCount = 0

    for (const [recipientId, actions] of Object.entries(grouped)) {
      if (prefMap[recipientId] === false) {
        console.log(`[CRON] ⏭️ Skipped ${recipientId} (email notifications disabled)`)
        skippedCount++
        continue
      }
      const first = actions[0]
      try {
        await sendDigestEmail(first.recipient_email, first.recipient_name, actions)
        console.log(`[CRON] ✉️ Sent digest to ${first.recipient_email} (${actions.length} action(s))`)
        sentCount++
      } catch (err) {
        console.error(`[CRON] ❌ Email error for ${first.recipient_email}:`, err)
      }
    }

    // Delete all processed items (whether sent or opted-out)
    const processedIds = items.map((i: any) => i.id)
    await admin.from('email_digest_queue').delete().in('id', processedIds)

    console.log(
      `[CRON] ✅ Done. Sent: ${sentCount} | Skipped: ${skippedCount} | Deleted from queue: ${processedIds.length}`
    )

    return NextResponse.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      total: items.length,
    })

  } catch (error: any) {
    console.error('[CRON] 💥 Unhandled exception:', error?.message ?? error)
    return NextResponse.json(
      { error: error?.message ?? 'Internal Server Error' },
      { status: 500 }
    )
  }
}