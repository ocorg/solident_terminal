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

  // Also fetch secondary contexts to check manager status there too
  const { data: secContexts } = await admin
    .from('task_secondary_contexts')
    .select('context_type, context_id')
    .eq('task_id', taskId)
  const allContexts = [
    { context_type: task.context_type, context_id: task.context_id },
    ...(secContexts || []),
  ]

  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', userId).single()
  if (profile?.is_admin) return { isManager: true, isAssigned: true }

  const { data: assignment } = await admin
    .from('task_assignees').select('user_id').eq('task_id', taskId).eq('user_id', userId).single()
  const isAssigned = !!assignment

  const positionResults = await Promise.all(allContexts.map(ctx => {
    if (ctx.context_type === 'project') {
      return admin
        .from('project_members')
        .select('project_positions(position_name)')
        .eq('project_id', ctx.context_id)
        .eq('user_id', userId)
        .single()
    } else {
      return admin
        .from('cellule_members')
        .select('cellule_positions(position_name)')
        .eq('cellule_id', ctx.context_id)
        .eq('user_id', userId)
        .single()
    }
  }))

  const isManager = positionResults.some(({ data: membership }) => {
    const pos = (membership as { project_positions?: { position_name: any }[] })?.project_positions?.[0]?.position_name
      ?? (membership as { cellule_positions?: { position_name: any }[] })?.cellule_positions?.[0]?.position_name
      ?? ''
    return pos !== '' && !pos.toLowerCase().includes('membre')
  })

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
    last_updated_by: user.id,
    last_updated_at: new Date().toISOString(),
  }
  // Whitelist only columns that exist on the tasks table
  if (body.title       !== undefined) updates.title       = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.status      !== undefined) updates.status      = body.status
  if (body.priority    !== undefined) updates.priority    = body.priority
  if (body.due_date    !== undefined) updates.due_date    = body.due_date || null
  if (body.context_type !== undefined) updates.context_type = body.context_type
  if (body.context_id  !== undefined) updates.context_id  = body.context_id
  if (body.archived    !== undefined) updates.archived    = body.archived
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

  // Update secondary contexts if provided
  if (Array.isArray(body.secondary_contexts)) {
    await admin.from('task_secondary_contexts').delete().eq('task_id', id)
    if (body.secondary_contexts.length > 0) {
      await admin.from('task_secondary_contexts').insert(
        body.secondary_contexts.map((sc: { context_type: string; context_id: string }) => ({
          task_id: id, context_type: sc.context_type, context_id: sc.context_id,
        }))
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

      const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', assigneeIds)
      const { data: emailPrefs } = await admin.from('user_email_prefs').select('user_id, email_enabled').in('user_id', assigneeIds)
      
      const prefMap: Record<string, boolean> = {}
      ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

      for (const assigneeId of assigneeIds) {
        if (prefMap[assigneeId] === false) continue
        
        const profile = (profiles || []).find((p: any) => p.id === assigneeId)
        if (!profile?.full_name) continue

        const { data: authUser } = await admin.auth.admin.getUserById(assigneeId)

        if (authUser?.user?.email) {
          await queueDigest(assigneeId, authUser.user.email, profile.full_name, 'task_updated', {
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