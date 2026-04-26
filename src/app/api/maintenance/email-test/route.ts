import { NextRequest, NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDigestEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST — { target: 'user' | 'all', userId?: string }
export async function POST(req: NextRequest) {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const { target, userId } = await req.json()

  if (!target || (target === 'user' && !userId)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Collect recipients: { email, name }
  const recipients: { email: string; name: string }[] = []

  if (target === 'all') {
    const { data: profiles } = await admin.from('profiles').select('id, full_name')
    const allIds = (profiles || []).map((p: any) => p.id)

    for (const p of profiles || []) {
      const { data: authUser } = await admin.auth.admin.getUserById(p.id)
      if (authUser?.user?.email) {
        recipients.push({ email: authUser.user.email, name: p.full_name })
      }
    }
  } else {
    const { data: profile } = await admin
      .from('profiles').select('full_name').eq('id', userId).single()
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    if (authUser?.user?.email && profile?.full_name) {
      recipients.push({ email: authUser.user.email, name: profile.full_name })
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire trouvé' }, { status: 404 })
  }

  const testPayload = [{
    action_type: 'task_assigned',
    payload:     { title: `Test de connectivité email — ${new Date().toLocaleString('fr-MA')}` },
  }]

  const errors: string[] = []
  let sentCount = 0

  for (const { email, name } of recipients) {
    try {
      await sendDigestEmail(email, name, testPayload)
      sentCount++
    } catch (err: any) {
      errors.push(`${email}: ${err?.message}`)
    }
  }

  return NextResponse.json({
    success:    sentCount > 0,
    sent:       sentCount,
    total:      recipients.length,
    errors:     errors.length > 0 ? errors : undefined,
  })
}