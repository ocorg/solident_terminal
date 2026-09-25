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
    .from('project_proposals')
    .select(`
      *,
      proposer:profiles!project_proposals_proposed_by_fkey(id, full_name, username),
      reviewer:profiles!project_proposals_reviewed_by_fkey(id, full_name, username),
      chef:profiles!project_proposals_suggested_chef_fkey(id, full_name, username),
      parent:projects!project_proposals_parent_project_id_fkey(id, name)
    `)
    .order('proposed_at', { ascending: false })

  if (!profile?.is_admin) {
    query = query.eq('proposed_by', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title, description, type, is_activity,
    parent_project_id, suggested_chef,
    estimated_budget, timeline, motivation
  } = body

  if (!title || !type) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('project_proposals').insert({
    title,
    description:       description       || null,
    proposed_by:       user.id,
    proposed_at:       new Date().toISOString(),
    status:            'En attente',
    type,
    is_activity:       is_activity       || false,
    parent_project_id: parent_project_id || null,
    suggested_chef:    suggested_chef    || null,
    review_notes: JSON.stringify({
      estimated_budget: estimated_budget || null,
      timeline:         timeline         || null,
      motivation:       motivation        || null,
    }),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}