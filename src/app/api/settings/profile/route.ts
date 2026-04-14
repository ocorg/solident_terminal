import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { full_name, username, email_enabled, avatar_url } = await req.json()
  const admin = createAdminClient()

  // Check username not taken by someone else
  if (username) {
    const { data: existing } = await admin
      .from('profiles').select('id').eq('username', username).neq('id', user.id).single()
    if (existing) return NextResponse.json({ error: 'Nom d\'utilisateur déjà pris' }, { status: 409 })
  }

  // Update profile
  const updatePayload: Record<string, unknown> = { full_name, username }
  if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url
  const { error: profileError } = await admin.from('profiles')
    .update(updatePayload).eq('id', user.id)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Update email prefs
  if (email_enabled !== undefined) {
    await admin.from('user_email_prefs').upsert({ user_id: user.id, email_enabled })
  }

  return NextResponse.json({ status: 'updated' })
}