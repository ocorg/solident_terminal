import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    await Promise.all([
      admin.from('login_logs').insert({
        user_id:    user.id,
        status:     'success',
        created_at: new Date().toISOString(),
      }),
      admin.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id),
    ])
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'ok' }) // non-blocking, never fail
  }
}