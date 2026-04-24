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

  const profileUpdate: Record<string, unknown> = {}
  if (body.full_name !== undefined) profileUpdate.full_name = body.full_name
  if (body.username  !== undefined) profileUpdate.username  = body.username
  if (body.is_admin  !== undefined) profileUpdate.is_admin  = body.is_admin

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdate).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Admin can also toggle email pref for any user
  if (body.email_enabled !== undefined) {
    const { error: prefError } = await admin
      .from('user_email_prefs')
      .upsert({ user_id: id, email_enabled: body.email_enabled }, { onConflict: 'user_id' })
    if (prefError) return NextResponse.json({ error: prefError.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Nullify references (keep the content, remove the author link)
  await admin.from('tasks').update({ created_by: null }).eq('created_by', id)
  await admin.from('tasks').update({ last_updated_by: null }).eq('last_updated_by', id)
  await admin.from('comments').update({ author_id: null }).eq('author_id', id)
  await admin.from('projects').update({ proposed_by: null }).eq('proposed_by', id)
  await admin.from('project_proposals').update({ proposed_by: null }).eq('proposed_by', id)
  await admin.from('project_proposals').update({ reviewed_by: null }).eq('reviewed_by', id)
  await admin.from('events').update({ created_by: null }).eq('created_by', id)

  // Remove membership records entirely
  await admin.from('task_assignees').delete().eq('user_id', id)
  await admin.from('project_members').delete().eq('user_id', id)
  await admin.from('cellule_members').delete().eq('user_id', id)
  await admin.from('event_attendees').delete().eq('user_id', id)
  await admin.from('notifications').delete().eq('recipient_id', id)
  await admin.from('user_email_prefs').delete().eq('user_id', id)
  await admin.from('login_logs').delete().eq('user_id', id)

  // Delete auth user — cascades to profiles automatically
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'deleted' })
}