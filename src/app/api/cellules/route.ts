import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()

  let cellules

  if (profile?.is_admin) {
    const { data } = await supabase
      .from('cellules')
      .select(`*, cellule_members(user_id, profiles(full_name), cellule_positions(position_name))`)
      .order('name')
    cellules = data
  } else {
    const { data: memberRows } = await supabase
      .from('cellule_members').select('cellule_id').eq('user_id', user.id)
    const ids = (memberRows || []).map(r => r.cellule_id)
    if (!ids.length) return NextResponse.json([])
    const { data } = await supabase
      .from('cellules')
      .select(`*, cellule_members(user_id, profiles(full_name), cellule_positions(position_name))`)
      .in('id', ids)
      .order('name')
    cellules = data
  }

  return NextResponse.json(cellules || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('cellules')
    .insert({ name, description: description || null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}