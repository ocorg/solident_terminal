import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const { error } = await admin.from('profiles')
    .update({
      full_name: body.full_name,
      username:  body.username,
      is_admin:  body.is_admin,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Clean up all related records before deleting the auth user
  await admin.from('task_assignees').delete().eq('user_id', id)
  await admin.from('project_members').delete().eq('user_id', id)
  await admin.from('cellule_members').delete().eq('user_id', id)
  await admin.from('event_attendees').delete().eq('user_id', id)
  await admin.from('notifications').delete().eq('recipient_id', id)
  await admin.from('user_email_prefs').delete().eq('user_id', id)
  await admin.from('login_logs').delete().eq('user_id', id)
  await admin.from('comments').delete().eq('author_id', id)
  await admin.from('tasks').update({ created_by: null }).eq('created_by', id)

  // Now delete the auth user (cascades to profiles automatically)
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'deleted' })
}