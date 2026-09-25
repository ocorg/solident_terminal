import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()

  let projects

  // Cache for 30 seconds on CDN, revalidate in background
  const headers = { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' }
  if (profile?.is_admin) {
    const { data } = await supabase
      .from('projects')
      .select(`*, project_members(user_id, profiles(full_name), project_positions(position_name))`)
      .is('parent_project_id', null)
      .order('created_at', { ascending: false })
    projects = data
  } else {
    const { data: memberRows } = await supabase
      .from('project_members').select('project_id').eq('user_id', user.id)
    const ids = (memberRows || []).map(r => r.project_id)
    if (!ids.length) return NextResponse.json([])
    const { data } = await supabase
      .from('projects')
      .select(`*, project_members(user_id, profiles(full_name), project_positions(position_name))`)
      .in('id', ids)
      .is('parent_project_id', null)
      .order('created_at', { ascending: false })
    projects = data
  }

  return NextResponse.json(projects || [], {
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, status, start_date, end_date, is_multi_activite, parent_project_id } = body
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').insert({
    name, description: description || null,
    status: status || 'Actif',
    approval_status: 'Approuvé',
    proposed_by: user.id,
    is_multi_activite: is_multi_activite || false,
    start_date: start_date || null,
    end_date: end_date || null,
    parent_project_id: parent_project_id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}