import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { rsvp_status } = await req.json()

  if (!['Oui', 'Non', 'En attente'].includes(rsvp_status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('event_attendees').upsert({
    event_id:    id,
    user_id:     user.id,
    rsvp_status,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'updated' })
}