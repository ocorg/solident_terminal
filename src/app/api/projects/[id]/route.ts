import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function canManage(userId: string, projectId: string, isAdmin: boolean) {
  if (isAdmin) return true
  const supabase = await createClient()

  const { data: positions } = await supabase
    .from('project_positions')
    .select('id, position_name')
    .eq('project_id', projectId)

  const mgmtIds = new Set(
    (positions || [])
      .filter(p => !p.position_name.toLowerCase().includes('membre'))
      .map(p => p.id)
  )

  const { data: membership } = await supabase
    .from('project_members')
    .select('position_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  return membership ? mgmtIds.has(membership.position_id) : false
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_members(
        id, user_id,
        profiles(id, full_name, username),
        project_positions(id, position_name)
      ),
      project_positions(id, position_name)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch sub-activities
  const { data: subActivities } = await supabase
    .from('projects')
    .select('*')
    .eq('parent_project_id', id)

  // Fetch task stats
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('context_id', id)

  return NextResponse.json({ ...data, sub_activities: subActivities || [], tasks: tasks || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  const allowed = await canManage(user.id, id, !!profile?.is_admin)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'deleted' })
}