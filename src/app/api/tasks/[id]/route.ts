import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getPermissions(userId: string, taskId: string) {
  const admin = createAdminClient()

  const { data: task } = await admin
    .from('tasks')
    .select('context_type, context_id')
    .eq('id', taskId)
    .single()
  if (!task) return { isManager: false, isAssigned: false }

  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', userId).single()
  if (profile?.is_admin) return { isManager: true, isAssigned: true }

  const { data: assignment } = await admin
    .from('task_assignees').select('user_id').eq('task_id', taskId).eq('user_id', userId).single()
  const isAssigned = !!assignment

  let isManager = false
  if (task.context_type === 'project') {
    const { data: membership } = await admin
      .from('project_members')
      .select('project_positions(position_name)')
      .eq('project_id', task.context_id)
      .eq('user_id', userId)
      .single()
    const pos = (membership?.project_positions as any)?.position_name ?? ''
    isManager = pos !== '' && !pos.toLowerCase().includes('membre')
  } else if (task.context_type === 'cellule') {
    const { data: membership } = await admin
      .from('cellule_members')
      .select('cellule_positions(position_name)')
      .eq('cellule_id', task.context_id)
      .eq('user_id', userId)
      .single()
    const pos = (membership?.cellule_positions as any)?.position_name ?? ''
    isManager = pos !== '' && !pos.toLowerCase().includes('membre')
  }

  return { isManager, isAssigned }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { isManager, isAssigned } = await getPermissions(user.id, id)

  const isStatusOnly = Object.keys(body).length === 1 && 'status' in body
  const isDestructive = 'archived' in body
  const isEdit = !isStatusOnly

  if (isStatusOnly && !isAssigned && !isManager) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }
  if ((isDestructive || isEdit) && !isManager) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {
    ...body,
    last_updated_by: user.id,
    last_updated_at: new Date().toISOString(),
  }

  if (body.status === '🔄 En cours' && !body.started_at)   updates.started_at   = new Date().toISOString()
  if (body.status === '✅ Terminé'  && !body.completed_at) updates.completed_at = new Date().toISOString()

  const { data, error } = await admin.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update assignees if provided
  if (Array.isArray(body.assignee_ids)) {
    await admin.from('task_assignees').delete().eq('task_id', id)
    if (body.assignee_ids.length > 0) {
      await admin.from('task_assignees').insert(
        body.assignee_ids.map((uid: string) => ({ task_id: id, user_id: uid }))
      )
    }
  }

  // Notify other assignees of changes (status update, edit)
  if (isStatusOnly || (!Array.isArray(body.assignee_ids) && isEdit)) {
    const { data: task } = await admin.from('tasks').select('title').eq('id', id).single()
    const { data: assignees } = await admin
      .from('task_assignees').select('user_id').eq('task_id', id).neq('user_id', user.id)

    if (task && assignees && assignees.length > 0) {
      const { queueDigest } = await import('@/lib/digest')
      const assigneeIds = assignees.map((a: any) => a.user_id)
      const { data: authUsersData } = await admin.auth.admin.listUsers()
      const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', assigneeIds)
      const { data: emailPrefs } = await admin.from('user_email_prefs').select('user_id, email_enabled').in('user_id', assigneeIds)
      const prefMap: Record<string, boolean> = {}
      ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

      for (const assigneeId of assigneeIds) {
        if (prefMap[assigneeId] === false) continue
        const authUser = authUsersData?.users?.find((u: any) => u.id === assigneeId)
        const profile  = (profiles || []).find((p: any) => p.id === assigneeId)
        if (authUser?.email && profile?.full_name) {
          await queueDigest(assigneeId, authUser.email, profile.full_name, 'task_updated', {
            title: task.title,
            detail: body.status ? `statut → ${body.status}` : 'modifiée',
          })
        }
      }
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { isManager } = await getPermissions(user.id, id)
  if (!isManager) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'deleted' })
}