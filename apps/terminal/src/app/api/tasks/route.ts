import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()

  const url = new URL(req.url ?? '', 'http://localhost')
  const showArchived = url.searchParams.get('archived') === 'true'

  let query = supabase
    .from('tasks')
    .select(`*, task_assignees(user_id, profiles(full_name, username, avatar_url)), task_secondary_contexts(context_type, context_id)`)
    .eq('archived', showArchived)
    .order('created_at', { ascending: false })

  if (!profile?.is_admin) {
    const { data: assigneeRows } = await supabase
      .from('task_assignees').select('task_id').eq('user_id', user.id)
    const ids = (assigneeRows || []).map(r => r.task_id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('id', ids)
  }

  const { data: tasks, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch context names separately (context_id is polymorphic — can't join directly)
  const projectIds = [...new Set(tasks.filter(t => t.context_type === 'project').map(t => t.context_id))]
  const celluleIds = [...new Set(tasks.filter(t => t.context_type === 'cellule').map(t => t.context_id))]

  const [{ data: projects }, { data: cellules }] = await Promise.all([
    projectIds.length > 0 ? supabase.from('projects').select('id, name').in('id', projectIds) : { data: [] },
    celluleIds.length > 0 ? supabase.from('cellules').select('id, name').in('id', celluleIds) : { data: [] },
  ])

  const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p.name]))
  const celluleMap = Object.fromEntries((cellules || []).map(c => [c.id, c.name]))

  // Collect all secondary context IDs for name lookup
  const allSecProj = [...new Set(tasks.flatMap(t =>
    (t.task_secondary_contexts || []).filter((s: any) => s.context_type === 'project').map((s: any) => s.context_id)
  ))]
  const allSecCel = [...new Set(tasks.flatMap(t =>
    (t.task_secondary_contexts || []).filter((s: any) => s.context_type === 'cellule').map((s: any) => s.context_id)
  ))]
  const [{ data: secProjects }, { data: secCellules }] = await Promise.all([
    allSecProj.length > 0 ? supabase.from('projects').select('id, name').in('id', allSecProj) : { data: [] },
    allSecCel.length > 0  ? supabase.from('cellules').select('id, name').in('id', allSecCel)  : { data: [] },
  ])
  const secProjectMap = Object.fromEntries((secProjects || []).map(p => [p.id, p.name]))
  const secCelluleMap = Object.fromEntries((secCellules || []).map(c => [c.id, c.name]))

  const enriched = tasks.map(t => ({
    ...t,
    context_name: t.context_type === 'project'
      ? (projectMap[t.context_id] ?? t.context_type)
      : (celluleMap[t.context_id] ?? t.context_type),
    secondary_contexts: (t.task_secondary_contexts || []).map((s: any) => ({
      context_type: s.context_type,
      context_id:   s.context_id,
      context_name: s.context_type === 'project'
        ? (secProjectMap[s.context_id] ?? s.context_id)
        : (secCelluleMap[s.context_id] ?? s.context_id),
    })),
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await req.json()
  const { title, description, context_type, context_id, priority, due_date, assignee_ids, secondary_contexts } = body

  if (!title || !context_type || !context_id) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  // Check permission: admin or manager in the target context
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) {
    let isManager = false
    if (context_type === 'project') {
      const { data: membership } = await admin
        .from('project_members')
        .select('project_positions(position_name)')
        .eq('project_id', context_id)
        .eq('user_id', user.id)
        .single()
      const pos = (membership?.project_positions as any)?.position_name ?? ''
      isManager = pos !== '' && !pos.toLowerCase().includes('membre')
    } else if (context_type === 'cellule') {
      const { data: membership } = await admin
        .from('cellule_members')
        .select('cellule_positions(position_name)')
        .eq('cellule_id', context_id)
        .eq('user_id', user.id)
        .single()
      const pos = (membership?.cellule_positions as any)?.position_name ?? ''
      isManager = pos !== '' && !pos.toLowerCase().includes('membre')
    }
    if (!isManager) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

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

  // Insert secondary contexts if provided
  if (Array.isArray(secondary_contexts) && secondary_contexts.length > 0) {
    await admin.from('task_secondary_contexts').insert(
      secondary_contexts.map((sc: { context_type: string; context_id: string }) => ({
        task_id: task.id,
        context_type: sc.context_type,
        context_id:   sc.context_id,
      }))
    )
  }

  // Dispatch in-app notifications for assignees
  if (assignee_ids?.length > 0) {
    await admin.from('notifications').insert(
      assignee_ids.map((uid: string) => ({
        recipient_id: uid,
        type:         'task_assigned',
        target_id:    task.id,
        message:      `Vous avez été assigné à la tâche "${title}".`,
        status:       'Non lu',
      }))
    )
  }

  // Queue digest notifications for assignees
  if (assignee_ids?.length > 0) {
    const { queueDigest } = await import('@/lib/digest')
    const { data: assigneeProfiles } = await admin
      .from('profiles').select('id, full_name').in('id', assignee_ids)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs').select('user_id, email_enabled').in('user_id', assignee_ids)
    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })
    for (const assigneeId of assignee_ids) {
      if (prefMap[assigneeId] === false) continue
      const profile = (assigneeProfiles || []).find((p: any) => p.id === assigneeId)
      if (!profile?.full_name) continue
      const { data: authUser } = await admin.auth.admin.getUserById(assigneeId)
      if (authUser?.user?.email) {
        await queueDigest(assigneeId, authUser.user.email, profile.full_name, 'task_assigned', { title })
      }
    }
  }

  return NextResponse.json(task)
}