import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// GET - admin only: see all recent notifications with read status across all users
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify admin
  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch last 50 non-archived notifications across all users, joined with recipient profile
  const { data, error } = await admin
    .from('notifications')
    .select('id, message, type, status, created_at, recipient_id, profiles!recipient_id(full_name, username)')
    .in('status', ['Non lu', 'Lu'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
