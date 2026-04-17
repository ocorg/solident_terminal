import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use admin client so RLS on event_attendees doesn't filter to current user only
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('events')
    .select(`
      *,
      creator:profiles!events_created_by_fkey(id, full_name, username),
      event_attendees(user_id, rsvp_status, profiles(full_name))
    `)
    .order('start_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [], {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' }
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check permission — admin or non-Membre position holder
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()

  if (!profile?.is_admin) {
    const { data: pmRows } = await supabase
      .from('project_members').select('position_id, project_positions(position_name)').eq('user_id', user.id)
    const { data: cmRows } = await supabase
      .from('cellule_members').select('position_id, cellule_positions(position_name)').eq('user_id', user.id)

    const allPositions = [
      ...(pmRows || []).map((r: any) => r.project_positions?.position_name || ''),
      ...(cmRows || []).map((r: any) => r.cellule_positions?.position_name || ''),
    ]
    const canCreate = allPositions.some(p => !p.toLowerCase().includes('membre'))
    if (!canCreate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, type, context_type, context_id, start_at, end_at, location, visibility, invitee_ids } = body

  if (!title || !start_at) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })

  const admin = createAdminClient()
  const { data: event, error } = await admin.from('events').insert({
    title,
    description:  description  || null,
    type:         type         || 'Événement',
    context_type: context_type || 'global',
    context_id:   context_id   || null,
    start_at,
    end_at:       end_at       || null,
    location:     location     || null,
    visibility:   visibility   || 'Tous',
    created_by:   user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add attendees
  const attendeeIds: string[] = visibility === 'Tous'
    ? [] // global events — attendees added on RSVP
    : (invitee_ids || [])

  if (attendeeIds.length > 0) {
    await admin.from('event_attendees').insert(
      attendeeIds.map((uid: string) => ({
        event_id: event.id, user_id: uid, rsvp_status: 'En attente'
      }))
    )
    // Notify invitees
    await admin.from('notifications').insert(
      attendeeIds.map((uid: string) => ({
        recipient_id: uid,
        type:         'event_invited',
        target_id:    event.id,
        message:      `Vous avez été invité à l'événement "${title}".`,
        status:       'Non lu',
      }))
    )
  }

  // Queue email digest for invited attendees
  if (attendeeIds.length > 0) {
    const { queueDigest } = await import('@/lib/digest')
    
    const { data: attendeeProfiles } = await admin
      .from('profiles').select('id, full_name').in('id', attendeeIds)
    const { data: emailPrefs } = await admin
      .from('user_email_prefs').select('user_id, email_enabled').in('user_id', attendeeIds)

    const prefMap: Record<string, boolean> = {}
    ;(emailPrefs || []).forEach((p: any) => { prefMap[p.user_id] = p.email_enabled })

    for (const uid of attendeeIds) {
      if (prefMap[uid] === false) continue
      
      const profile = (attendeeProfiles || []).find((p: any) => p.id === uid)
      if (!profile?.full_name) continue

      const { data: authUser } = await admin.auth.admin.getUserById(uid)

      if (authUser?.user?.email) {
        await queueDigest(uid, authUser.user.email, profile.full_name, 'event_invited', { title })
      }
    }
  }

  return NextResponse.json(event)
}