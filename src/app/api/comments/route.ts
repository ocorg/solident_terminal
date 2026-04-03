import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_id, content } = await req.json()
  if (!task_id || !content?.trim()) {
    return NextResponse.json({ error: 'Contenu manquant' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('comments').insert({
    task_id, content: content.trim(), author_id: user.id,
  }).select('*, profiles(full_name, username)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}