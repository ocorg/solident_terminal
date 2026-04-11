import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { user_id, position_id } = await req.json()
  if (!user_id || !position_id) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('cellule_members').upsert({ cellule_id: id, user_id, position_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the added member
  const { data: cel } = await admin.from('cellules').select('name').eq('id', id).single()
  const { data: memberProfile } = await admin.from('profiles').select('full_name').eq('id', user_id).single()
  const { data: authUser } = await admin.auth.admin.getUserById(user_id)
  const { data: emailPref } = await admin.from('user_email_prefs').select('email_enabled').eq('user_id', user_id).single()

  if (cel && authUser?.user?.email && memberProfile?.full_name && emailPref?.email_enabled !== false) {
    const { queueDigest } = await import('@/lib/digest')
    await queueDigest(user_id, authUser.user.email, memberProfile.full_name, 'added_to_cellule', { title: cel.name })
  }

  return NextResponse.json({ status: 'added' })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { user_id } = await req.json()
  const admin = createAdminClient()
  const { error } = await admin.from('cellule_members')
    .delete().eq('cellule_id', id).eq('user_id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'removed' })
}