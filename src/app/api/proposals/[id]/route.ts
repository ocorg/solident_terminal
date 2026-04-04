import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status, review_notes } = await req.json()

  if (!['Approuvé', 'Rejeté'].includes(status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get proposal first
  const { data: proposal } = await admin
    .from('project_proposals').select('*').eq('id', id).single()
  if (!proposal) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Update proposal
  const { error } = await admin.from('project_proposals').update({
    status,
    review_notes,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If approved → auto-create project
  if (status === 'Approuvé') {
    const { data: project } = await admin.from('projects').insert({
      name:              proposal.title,
      description:       proposal.description,
      status:            'Actif',
      proposed_by:       proposal.proposed_by,
      approval_status:   'Approuvé',
      is_multi_activite: false,
      parent_project_id: proposal.parent_project_id || null,
    }).select().single()

    // Create default positions
    if (project) {
      const { data: chefPos } = await admin.from('project_positions').insert({
        project_id: project.id, position_name: 'Chef de Projet'
      }).select().single()

      await admin.from('project_positions').insert({
        project_id: project.id, position_name: 'Membre'
      })

      // Assign suggested chef
      if (proposal.suggested_chef && chefPos) {
        await admin.from('project_members').insert({
          project_id:  project.id,
          user_id:     proposal.suggested_chef,
          position_id: chefPos.id,
        })
      }

      // Notify proposer
      await admin.from('notifications').insert({
        recipient_id: proposal.proposed_by,
        type:         'proposal_approved',
        target_id:    project.id,
        message:      `Votre proposition "${proposal.title}" a été approuvée et le projet a été créé.`,
        status:       'Non lu',
      })
    }
  } else {
    // Notify proposer of rejection
    await admin.from('notifications').insert({
      recipient_id: proposal.proposed_by,
      type:         'proposal_rejected',
      target_id:    id,
      message:      `Votre proposition "${proposal.title}" a été rejetée.${review_notes ? ` Note: ${review_notes}` : ''}`,
      status:       'Non lu',
    })
  }

  return NextResponse.json({ status: 'updated' })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Only admin or the proposer can delete a pending proposal
  const admin = createAdminClient()
  const { data: proposal } = await admin
    .from('project_proposals').select('proposed_by, status').eq('id', id).single()

  if (!proposal) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()

  const isOwner = proposal.proposed_by === user.id
  const isPending = proposal.status === 'En attente'

  if (!profile?.is_admin && !(isOwner && isPending)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('project_proposals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'deleted' })
}