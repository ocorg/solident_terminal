import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// GET - fetch active notifications, auto-archive those older than 7 days
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Auto-archive notifications older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await admin
    .from('notifications')
    .update({ status: 'Archivé' })
    .eq('recipient_id', user.id)
    .in('status', ['Non lu', 'Lu'])
    .lt('created_at', sevenDaysAgo)

  // Fetch active (non-archived) notifications
  const { data, error } = await admin
    .from('notifications')
    .select('*')
    .eq('recipient_id', user.id)
    .in('status', ['Non lu', 'Lu'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// PATCH - mark all read (no body) OR mark single read (body: { id })
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  let body: { id?: string } = {}
  try { body = await req.json() } catch { /* no body = mark all */ }

  if (body.id) {
    const { error } = await admin
      .from('notifications')
      .update({ status: 'Lu' })
      .eq('id', body.id)
      .eq('recipient_id', user.id)
      .eq('status', 'Non lu')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin
      .from('notifications')
      .update({ status: 'Lu' })
      .eq('recipient_id', user.id)
      .eq('status', 'Non lu')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'updated' })
}
