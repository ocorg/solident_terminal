import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, username, is_admin } = await req.json()
  if (!email || !full_name || !username) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check username not taken
  const { data: existing } = await admin
    .from('profiles').select('id').eq('username', username).single()
  if (existing) return NextResponse.json({ error: 'Nom d\'utilisateur déjà pris' }, { status: 409 })

  // Send invite — Supabase emails the magic link
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, username },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Set is_admin if needed (profile created by trigger, then we patch)
  if (is_admin && data.user) {
    await admin.from('profiles').update({ is_admin: true }).eq('id', data.user.id)
  }

  return NextResponse.json({ status: 'invited' })
}