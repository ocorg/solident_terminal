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

  // Get commenter's name
  const { data: authorProfile } = await admin
    .from('profiles').select('full_name').eq('id', user.id).single()

  const { data, error } = await admin.from('comments').insert({
    task_id, content: content.trim(), author_id: user.id,
  }).select('*, profiles(full_name, username)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get task title and all assignees except commenter
  const { data: task } = await admin.from('tasks').select('title').eq('id', task_id).single()
  const { data: assignees } = await admin
    .from('task_assignees').select('user_id').eq('task_id', task_id).neq('user_id', user.id)

  if (task && assignees && assignees.length > 0) {
    const { queueDigest } = await import('@/lib/digest')
    const assigneeIds = assignees.map((a: any) => a.user_id)

    const { data: assigneeProfiles } = await admin
      .from('profiles').select('id, full_name').in('id', assigneeIds)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs').select('user_id, email_enabled').in('user_id', assigneeIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

    for (const assigneeId of assigneeIds) {
      if (prefMap[assigneeId] === false) continue
      
      const profile = (assigneeProfiles || []).find((p: any) => p.id === assigneeId)
      if (!profile?.full_name) continue

      // 2. Targeted lookup for the specific user
      const { data: authUser } = await admin.auth.admin.getUserById(assigneeId)

      // 3. Use the correct email path: authUser.user.email
      if (authUser?.user?.email) {
        await queueDigest(assigneeId, authUser.user.email, profile.full_name, 'task_comment', {
          title: task.title,
          detail: `par ${authorProfile?.full_name || 'un membre'}`,
        })
      }
    }
  }

  return NextResponse.json(data)
}