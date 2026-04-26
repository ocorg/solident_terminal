import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST — { target: 'user' | 'all', userId?: string, message?: string }
export async function POST(req: NextRequest) {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const { target, userId, message } = await req.json()

  if (!target || (target === 'user' && !userId)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const admin = createAdminClient()
  const testMessage = message || `🛠️ Notification de test envoyée depuis le module Maintenance. [${new Date().toLocaleString('fr-MA')}]`

  let recipientIds: string[] = []

  if (target === 'all') {
    const { data: profiles } = await admin.from('profiles').select('id')
    recipientIds = (profiles || []).map((p: any) => p.id)
  } else {
    recipientIds = [userId]
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire trouvé' }, { status: 404 })
  }

  const { error } = await admin.from('notifications').insert(
    recipientIds.map(id => ({
      recipient_id: id,
      type:         'maintenance_test',
      message:      testMessage,
      status:       'Non lu',
    }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    sent_to: recipientIds.length,
    message: testMessage,
  })
}