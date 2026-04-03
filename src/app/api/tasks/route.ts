import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()

  let query = supabase
    .from('tasks')
    .select(`*, task_assignees(user_id, profiles(full_name, username))`)
    .order('created_at', { ascending: false })

  // Non-admins only see tasks they're assigned to
  if (!profile?.is_admin) {
    const { data: assigneeRows } = await supabase
      .from('task_assignees').select('task_id').eq('user_id', user.id)
    const ids = (assigneeRows || []).map(r => r.task_id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, context_type, context_id, priority, due_date, assignee_ids } = body

  if (!title || !context_type || !context_id) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: task, error } = await admin.from('tasks').insert({
    title,
    description:    description || null,
    context_type,
    context_id,
    priority:       priority  || '🟡 Moyen',
    status:         '📋 À faire',
    due_date:       due_date  || null,
    created_by:     user.id,
    last_updated_by: user.id,
    last_updated_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Assign users
  if (assignee_ids?.length > 0) {
    await admin.from('task_assignees').insert(
      assignee_ids.map((uid: string) => ({ task_id: task.id, user_id: uid }))
    )
  }

  // Always assign creator
  await admin.from('task_assignees').upsert({ task_id: task.id, user_id: user.id })

  return NextResponse.json(task)
}